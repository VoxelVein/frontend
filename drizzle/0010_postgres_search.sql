-- Replaces the Meilisearch indexes with Postgres-native search.
--
-- Purely additive: one extension, one role setting and five indexes. No
-- existing column, constraint or row is altered or dropped.

-- Trigram matching backs the fuzzy half of search: it finds "sodim" for
-- "Sodium", which full-text search cannot do.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint

-- The `%` operator reads its threshold from this setting rather than taking an
-- argument, so pinning it keeps fuzzy recall deterministic instead of inherited
-- from whatever the extension happens to default to. Resolved through
-- current_user so the migration does not hardcode a role name.
DO $$
BEGIN
  EXECUTE format(
    'alter role %I set pg_trgm.similarity_threshold = %s',
    current_user,
    '0.3'
  );
END
$$;
--> statement-breakpoint

-- `array_to_string` is what turns the `tags` array into searchable text, but
-- Postgres marks it STABLE rather than IMMUTABLE, and an index expression may
-- only be immutable. This wrapper performs the same computation declared
-- immutable, which is sound for text[] specifically: the result depends only on
-- its arguments. The catalogue marks the original STABLE because of the general
-- anyelement case, where element output functions are not assumed immutable.
--
-- The search_path is pinned so the body cannot later resolve to a different
-- array_to_string, which would silently invalidate every index entry built from
-- it.
-- The body is named `array_value` rather than `values` because VALUES is a
-- reserved word in Postgres and cannot be used as a parameter name.
CREATE OR REPLACE FUNCTION public.immutable_array_to_string(
  array_value text[],
  separator text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$ SELECT array_to_string(array_value, separator) $$;
--> statement-breakpoint

-- The two vector indexes below index expressions that are duplicated verbatim in
-- PROJECT_SEARCH_VECTOR and POST_SEARCH_VECTOR (src/lib/search/text.ts). A GIN
-- expression index is only used when the query repeats the expression exactly,
-- so the SQL here and the sql template there must stay identical: same
-- functions, same order, same 'english'::regconfig casts. Divergence does not
-- error — it silently falls back to a sequential scan, which is why the search
-- query's index usage is asserted in src/lib/__tests__/search-index.test.ts.
-- The extra parentheses around the concatenated expression are required: without
-- them Postgres reads the first `||` as a syntax error in the index definition.
CREATE INDEX "projects_search_vector_idx" ON "projects" USING GIN ((
  setweight(to_tsvector('english'::regconfig, coalesce("name", '')), 'A') ||
  setweight(to_tsvector('english'::regconfig, coalesce("summary", '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, coalesce("description", '')), 'C') ||
  setweight(to_tsvector('english'::regconfig, coalesce(public.immutable_array_to_string("tags", ' '), '')), 'C')
));
--> statement-breakpoint

-- The post body is indexed at the lowest weight so a phrase search inside an
-- article still finds it, as it did through Meilisearch, while never outranking
-- a title match. It is a real cost: the body is capped at 50,000 characters, so
-- this vector is recomputed on every write and stored for every row.
CREATE INDEX "posts_search_vector_idx" ON "posts" USING GIN ((
  setweight(to_tsvector('english'::regconfig, coalesce("title", '')), 'A') ||
  setweight(to_tsvector('english'::regconfig, coalesce("excerpt", '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, coalesce("slug", '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, coalesce("content", '')), 'D')
));
--> statement-breakpoint

-- Trigram indexes back the fuzzy and substring branches of the match predicate.
-- One index per field serves both `field % query` and
-- `field ILIKE '%query%'`, because gin_trgm_ops covers both operators.
--
-- Only short fields are indexed. Trigram similarity compares character triples,
-- so it is meaningless against a 50,000-character description or post body; an
-- index there would be large and never consulted. The long fields are reachable
-- through the full-text vectors above instead.
CREATE INDEX "projects_name_trgm_idx" ON "projects" USING GIN ("name" gin_trgm_ops);
--> statement-breakpoint

CREATE INDEX "projects_summary_trgm_idx" ON "projects" USING GIN ("summary" gin_trgm_ops);
--> statement-breakpoint

CREATE INDEX "posts_title_trgm_idx" ON "posts" USING GIN ("title" gin_trgm_ops);
