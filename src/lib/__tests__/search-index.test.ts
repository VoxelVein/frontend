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
 * Those parentheses are not scaffolding to be ignored — `using gin (( ... ))`
 * indexes exactly the parenthesized expression — but they are the same on both
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
    // loudly — the search just gets slower as the table grows.
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
