import { readFileSync } from "node:fs";
import path from "node:path";

import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  matchPost,
  matchProject,
  POST_SEARCH_VECTOR,
  PROJECT_SEARCH_VECTOR,
  rankPost,
  rankProject,
  toTextQuery,
} from "@/lib/search/text";

const MIGRATION_PATH = path.resolve(
  import.meta.dirname,
  "../../../drizzle/0010_postgres_search.sql"
);

const migration = readFileSync(MIGRATION_PATH, "utf-8");

const dialect = new PgDialect();

/** Renders a Drizzle SQL template to the Postgres text it sends. */
const render = (query: SQL): string => dialect.sqlToQuery(query).sql;

/**
 * Reduces an expression to the form its two copies can be compared in.
 *
 * The migration writes index expressions with bare column names, because
 * `create index ... on projects` already scopes them, while the query qualifies
 * them as `projects."name"`. Those are the same expression, so the qualifier is
 * dropped from both sides; whitespace is collapsed for the same reason.
 *
 * Everything else is compared verbatim. A changed weight, a dropped field, a
 * different function, or a missing `'english'::regconfig` cast all survive this
 * and fail the test, which is the point: any of them stops Postgres using the
 * index, and none of them raise an error when it does.
 */
const normalize = (expression: string): string =>
  expression
    .replaceAll(/\b(?:projects|posts)\./gu, "")
    .replaceAll(/\s+/gu, " ")
    .trim();

/**
 * The concatenated `setweight` chain a vector is built from, without the
 * parentheses wrapped around it.
 *
 * Those parentheses are not scaffolding to be ignored (`using gin (( ... ))`
 * indexes exactly the parenthesized expression), but they are the same on both
 * sides, so the test compares what the chain actually searches.
 */
const vectorChain = (vector: SQL): string =>
  normalize(render(vector).replace(/^\(/u, "").replace(/\)$/u, ""));

/** Pulls the chain out of `create index ... using gin ((<chain>));`. */
const indexedChain = (indexName: string): string => {
  const match = migration.match(
    new RegExp(
      `create index "${indexName}"[^;]*?using gin \\(\\(([\\s\\S]*?)\\)\\);`,
      "iu"
    )
  );

  if (match === null) {
    throw new Error(`index ${indexName} not found in ${MIGRATION_PATH}`);
  }

  return normalize(match[1]);
};

/**
 * The columns a predicate fuzzy- or substring-matches, as `table.column`.
 *
 * The operator is followed by required whitespace rather than a word boundary:
 * `field % $1` has no boundary after `%`, because `$` is not a word character
 * either, and a boundary would quietly limit this to the `ilike` branches.
 *
 * A Set, because order is not part of the claim: the two field lists come from
 * unrelated SQL and only membership is being compared.
 */
const fuzzyFields = (predicate: string): Set<string> =>
  new Set(
    [
      ...predicate.matchAll(
        /(?<table>\w+)\."(?<column>\w+)"\s+(?:%|ilike)\s/gu
      ),
    ].map(({ groups }) => `${groups?.table}.${groups?.column}`)
  );

/** The columns the migration gives a `gin_trgm_ops` index, as `table.column`. */
const trgmIndexedFields = (): Set<string> =>
  new Set(
    [
      ...migration.matchAll(
        /create index "\w+" on "(?<table>\w+)" using gin \("(?<column>\w+)" gin_trgm_ops\)/giu
      ),
    ].map(({ groups }) => `${groups?.table}.${groups?.column}`)
  );

describe("search vector indexes", () => {
  it("indexes the same chain the projects query searches", () => {
    expect(indexedChain("projects_search_vector_idx")).toBe(
      vectorChain(PROJECT_SEARCH_VECTOR)
    );
  });

  it("indexes the same chain the posts query searches", () => {
    expect(indexedChain("posts_search_vector_idx")).toBe(
      vectorChain(POST_SEARCH_VECTOR)
    );
  });
});

/**
 * The `ILIKE` branches of a rendered predicate, one string per line.
 *
 * Split on newlines because Drizzle indents each `or` clause onto its own line,
 * which is what makes a branch readable enough to assert against.
 */
const ilikeBranches = (predicate: string): string[] =>
  predicate.split("\n").filter((line) => line.includes("ilike"));

/**
 * A rendered fragment with its parameter placeholders collapsed.
 *
 * Each `ILIKE` branch binds its own parameter — `$3` for a project's name, `$5`
 * for its summary — so a chain can only be compared by shape. Normalising here
 * beats matching a regex, which would be a second regex to keep reading.
 */
const withoutPlaceholders = (fragment: string): string =>
  fragment.replaceAll(/\$\d+/gu, "$?");

/**
 * The three-deep replace chain that escapes `ILIKE` wildcards.
 *
 * Backslash first, then `%`, then `_`, each doubled. Read as SQL text: escape
 * the escape character, then turn the two wildcards into literals that the
 * first step has already made safe.
 */
const ESCAPE_CHAIN =
  "replace(replace(replace($?, '\\', '\\\\'), '%', '\\%'), '_', '\\_')";

describe("wildcard escaping in the substring branches", () => {
  /**
   * `ILIKE` treats `%` and `_` as wildcards, so an unescaped visitor query turns
   * into a pattern. `100%` becomes "matches anything starting with 100", and
   * `light_bearer` matches `lightxbearer`.
   *
   * The escaping has to happen in SQL, not in JS: the value stays a bound
   * parameter (so this is not about injection), and Postgres only honours a
   * backslash as a literal escape inside `ILIKE`.
   *
   * These assertions are on the *rendered* SQL, which is the whole point. The
   * escaping was previously written with single backslashes inside a tagged
   * template, where `'\''` and `'\%'` are JavaScript escape sequences: the
   * function emitted `replace(x, '%', '%')`, a no-op that escaped nothing, and
   * every test that only checked "does an `ILIKE` branch exist" still passed.
   * A query with a live wildcard does not raise — it just matches too much.
   */
  it("escapes the percent sign instead of leaving it a wildcard", () => {
    const [name] = ilikeBranches(
      render(matchProject("100%", toTextQuery("100%")))
    );

    // `100%` typed literally must reach the pattern as `100\%`.
    expect(name).toContain("'%' || replace(replace(replace($3,");
    expect(name).toContain("'%', '\\%')");
    // The shape the no-op version had: a replace that puts a character back
    // unchanged escapes nothing and reads as if it does.
    expect(name).not.toContain("'%', '%')");
    expect(name).not.toContain("'', '\\')");
  });

  it("escapes the underscore so a partial word is not one character", () => {
    const [name] = ilikeBranches(
      render(matchProject("light_bearer", toTextQuery("light_bearer")))
    );

    expect(name).toContain("'_', '\\_')");
    expect(name).not.toContain("'_', '_')");
  });

  it("escapes the backslash before the wildcards, or it doubles them", () => {
    const [name] = ilikeBranches(
      render(matchProject("a\\b", toTextQuery("a\\b")))
    );

    // `\` becomes `\\` first; if the wildcards were escaped first, the
    // backslashes added for them would be doubled again and the pattern would
    // no longer match the text the visitor typed.
    expect(name).toContain("'\\', '\\\\')");
    expect(withoutPlaceholders(name ?? "")).toContain(ESCAPE_CHAIN);
  });

  it("escapes on every ILIKE branch, not just the first", () => {
    // Two columns for projects, one for posts. Escaping only the first would
    // leave the summary and title branches matching wildcards.
    const projects = ilikeBranches(
      render(matchProject("100%", toTextQuery("100%")))
    );
    const posts = ilikeBranches(render(matchPost("100%", toTextQuery("100%"))));

    expect(projects).toHaveLength(2);
    expect(posts).toHaveLength(1);
    for (const branch of [...projects, ...posts]) {
      expect(withoutPlaceholders(branch)).toContain(ESCAPE_CHAIN);
    }
  });

  it("keeps the value bound rather than interpolated into the SQL", () => {
    const query = dialect.sqlToQuery(matchProject("100%", toTextQuery("100%")));

    // The escaping rewrites the pattern; it must not turn the bound parameter
    // into literal SQL, which is what "escape it yourself" usually turns into.
    expect(query.sql).not.toContain("100%");
    expect(query.params).toContain("100%");
  });

  it("binds the raw query unescaped for trigram matching", () => {
    // The `%` operator takes a plain string and gets its own parameter.
    // Escaping it too would compare "100%" against `100\%`, which trigram
    // similarity scores as a near miss rather than an exact character.
    const predicate = render(matchProject("100%", toTextQuery("100%")));

    expect(predicate).toContain('projects."name" % $2');
  });
});

describe("relevance ranking", () => {
  it("blends full-text rank and name similarity into one score", () => {
    const score = render(rankProject("sodim", toTextQuery("sodim")));

    // `greatest`, not `+`: the two signals are each already 0..1, and summing
    // them would produce a score above 1 that no longer ranks against
    // anything.
    expect(score).toContain("greatest(");
    expect(score).toContain("ts_rank_cd(");
    // Parameters are numbered by position in the query, so the text query is
    // $1 here and the raw query $2.
    expect(score).toContain('similarity(projects."name", $2)');
  });

  it("ranks a post by its title and not its body", () => {
    // Matches `matchPost`: a body match is found by the full-text predicate but
    // must not dominate the score, or a long article outranks an exact title
    // match on name similarity.
    const score = render(rankPost("sodim", toTextQuery("sodim")));

    expect(score).toContain('similarity(posts."title", $2)');
    expect(score).not.toContain('similarity(posts."content"');
  });

  it("ranks on the same vector the predicate filters on", () => {
    // A rank built from a different vector than the `where` clause is a
    // correctness bug dressed as a tuning one: results still match, they just
    // order by something the query never considered.
    expect(normalize(render(rankProject("s", toTextQuery("s"))))).toContain(
      vectorChain(PROJECT_SEARCH_VECTOR)
    );
    expect(normalize(render(rankPost("s", toTextQuery("s"))))).toContain(
      vectorChain(POST_SEARCH_VECTOR)
    );
  });
});

describe("fuzzy matching", () => {
  it("matches projects with the operator the trigram index can answer", () => {
    const predicate = render(matchProject("sodim", toTextQuery("sodim")));

    // `field % query` is index-accelerated. The equivalent-looking
    // `similarity(field, query) > 0.3` is not: it reads the same and is answered
    // by a sequential scan, so fuzzy search would keep working while quietly
    // losing the index.
    expect(predicate).toContain("% $");
    expect(predicate).not.toMatch(/similarity\([^)]*\)\s*>/u);
  });

  it("matches posts with the operator the trigram index can answer", () => {
    const predicate = render(matchPost("sodim", toTextQuery("sodim")));

    expect(predicate).toContain("% $");
    expect(predicate).not.toMatch(/similarity\([^)]*\)\s*>/u);
  });

  it("fuzzy-matches exactly the fields the migration gives a trigram index", () => {
    // `field % query` and `field ilike '%query%'` are only accelerated when the
    // column is covered by a gin_trgm_ops index. Adding a field to the
    // predicate without one still returns correct results, so nothing fails
    // loudly. The search just gets slower as the table grows.
    const indexed = trgmIndexedFields();
    const forProjects = new Set(
      [...indexed].filter((field) => field.startsWith("projects."))
    );
    const forPosts = new Set(
      [...indexed].filter((field) => field.startsWith("posts."))
    );

    expect(
      fuzzyFields(render(matchProject("sodim", toTextQuery("sodim"))))
    ).toStrictEqual(forProjects);
    expect(
      fuzzyFields(render(matchPost("sodim", toTextQuery("sodim"))))
    ).toStrictEqual(forPosts);
  });

  it("leaves the post body to full-text search, the only branch that can reach it", () => {
    // Trigram similarity compares character triples, so it is meaningless
    // against a 50,000-character body: the score is ~0 and the index would be
    // enormous. The body must therefore be in the vector and nowhere else.
    expect(vectorChain(POST_SEARCH_VECTOR)).toContain('"content"');
    expect(
      fuzzyFields(render(matchPost("sodim", toTextQuery("sodim")))).has(
        "posts.content"
      )
    ).toBeFalsy();
  });
});
