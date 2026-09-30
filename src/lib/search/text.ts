import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

/**
 * Trigram similarity above which two strings count as the same.
 *
 * This value is pinned in the database by migration `0010_postgres_search`, via
 * `ALTER DATABASE ... SET pg_trgm.similarity_threshold`, because the `%`
 * operator below reads the setting rather than taking a threshold argument. The
 * two must agree; the constant is repeated here so the intent is visible at the
 * point of use.
 *
 * 0.3 is the conventional floor. It is high enough that two unrelated names do
 * not match on a shared handful of letters, and low enough that a single
 * transposed or dropped letter still matches: "sodim" finds "Sodium", "optfine"
 * finds "OptiFine". Users mistype mod and plugin names constantly, so this is
 * what makes search feel forgiving.
 */
export const FUZZY_THRESHOLD = 0.3;

/**
 * The weighted text vector for a project.
 *
 * This expression is duplicated verbatim in the GIN index created by migration
 * `0010_postgres_search`. Postgres only uses a GIN expression index when the
 * query repeats the expression exactly, so the two must stay identical: same
 * functions, same order, same `'english'::regconfig` casts. Changing one without
 * the other does not error, it silently falls back to a sequential scan.
 *
 * Weights: a name match outranks a summary match, which outranks description or
 * tag matches.
 */
export const PROJECT_SEARCH_VECTOR = sql`(
  setweight(to_tsvector('english'::regconfig, coalesce(projects."name", '')), 'A') ||
  setweight(to_tsvector('english'::regconfig, coalesce(projects."summary", '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, coalesce(projects."description", '')), 'C') ||
  setweight(to_tsvector('english'::regconfig, coalesce(public.immutable_array_to_string(projects."tags", ' '), '')), 'C')
)`;

/**
 * The weighted text vector for a post.
 *
 * The body is included at weight `D` so searching a phrase inside an article
 * still finds it, while never outranking a title
 * match. It is a real cost: the body is capped at 50,000 characters, so this
 * vector is recomputed on every write and stored in the index for every row.
 */
export const POST_SEARCH_VECTOR = sql`(
  setweight(to_tsvector('english'::regconfig, coalesce(posts."title", '')), 'A') ||
  setweight(to_tsvector('english'::regconfig, coalesce(posts."excerpt", '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, coalesce(posts."slug", '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, coalesce(posts."content", '')), 'D')
)`;

/**
 * Builds a full-text query from raw user input.
 *
 * `websearch_to_tsquery` is used rather than `to_tsquery` because it accepts
 * quotes, `OR` and `-`, and (critically) never raises on malformed input. A
 * stray character in the search box degrades to a weaker query instead of
 * failing the request with a 500.
 */
export const toTextQuery = (value: string): SQL =>
  sql`websearch_to_tsquery('english'::regconfig, ${value})`;

/**
 * Escapes the wildcards `ILIKE` would otherwise interpret.
 *
 * Without this, a visitor searching for `100%` would be handing the database a
 * pattern that matches every row, and searching for `light_bearer` would match
 * `lightxbearer`. The values are still bound parameters, so this is about
 * honouring what the visitor literally typed, not about injection.
 */
const escapeWildcards = (value: SQL): SQL =>
  sql`replace(replace(replace(${value}, '\', '\\'), '%', '\%'), '_', '\_')`;

/**
 * Matches a project on full-text relevance, fuzzily, or by substring.
 *
 * Three complementary branches, because each finds something the others miss:
 *
 * - The vector catches real words, including ones buried in the description or
 *   tags, which trigrams are too blunt to reach.
 * - `%` catches typos. It uses the trigram similarity threshold from the
 *   database rather than a literal, because only that form is answered by the
 *   GIN trigram index; spelling `similarity(...) > 0.3` out in the query would
 *   quietly turn every fuzzy search into a sequential scan. Trigram comparison
 *   is case-insensitive, so "sodim" already matches "Sodium".
 * - `ILIKE` catches substrings. `%` does not: "Sodium" scores 0.0 against "ium",
 *   because trigram similarity compares strings of similar length, while a
 *   substring match is exactly what a visitor typing part of a name wants.
 *
 * Only `name` and `summary` get the fuzzy and substring branches. Both are
 * bounded-length fields with their own trigram indexes. Tags and the description
 * are reachable through the full-text vector instead, which keeps the unindexed
 * part of the predicate small enough not to force a scan.
 */
export const matchProject = (rawQuery: string, textQuery: SQL): SQL => {
  const pattern = escapeWildcards(sql`${rawQuery}`);

  return sql`(
    ${PROJECT_SEARCH_VECTOR} @@ ${textQuery}
    or projects."name" % ${rawQuery}
    or projects."name" ilike '%' || ${pattern} || '%'
    or projects."summary" % ${rawQuery}
    or projects."summary" ilike '%' || ${pattern} || '%'
  )`;
};

/**
 * Matches a post on full-text relevance, fuzzily, or by substring.
 *
 * The body is reachable through full-text search but never through trigrams, for
 * the same reason project descriptions are not.
 */
export const matchPost = (rawQuery: string, textQuery: SQL): SQL => {
  const pattern = escapeWildcards(sql`${rawQuery}`);

  return sql`(
    ${POST_SEARCH_VECTOR} @@ ${textQuery}
    or posts."title" % ${rawQuery}
    or posts."title" ilike '%' || ${pattern} || '%'
  )`;
};

/**
 * Relevance score for a project, blending both signals onto one 0..1 scale.
 *
 * The `setweight` calls in the vector already decide how much a title match is
 * worth against a description match, so `ts_rank_cd` reflects that weighting and
 * only has to blend in how close the name was as a whole.
 */
export const rankProject = (rawQuery: string, textQuery: SQL): SQL =>
  sql`greatest(
    ts_rank_cd(${PROJECT_SEARCH_VECTOR}, ${textQuery}),
    similarity(projects."name", ${rawQuery})
  )`;

/** Relevance score for a post. See `rankProject`. */
export const rankPost = (rawQuery: string, textQuery: SQL): SQL =>
  sql`greatest(
    ts_rank_cd(${POST_SEARCH_VECTOR}, ${textQuery}),
    similarity(posts."title", ${rawQuery})
  )`;
