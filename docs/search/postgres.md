# Search

Search runs inside Postgres. There is no search service to run, no key to
configure, and no index to keep in step with the tables it was built from.

`/mods`, `/plugins`, and the blog all query Postgres directly through server
functions.

## How it works

* `src/lib/search/text.ts` — the shared matching and ranking expressions:
  the weighted `tsvector` for each table, the fuzzy/substring predicate, and
  the relevance score
* `src/lib/search/projects.ts` — `searchProjectsInDatabase`, which filters,
  ranks, sorts, pages, and returns facet counts in one round trip
* `src/lib/search/posts.ts` — `searchPostsInDatabase` and
  `hasSearchablePosts`
* `src/lib/project-search.functions.ts` — the `searchProjects` server
  function; validates filters against the same allowlists the UI offers
* `src/lib/posts.functions.ts` — `searchPosts`, `searchPostsAdmin`, and
  `postSearchAvailable`
* `drizzle/0010_postgres_search.sql` — the extension, the trigram
  threshold, and the five indexes that back the queries

## Two matching strategies

Each query ORs together three branches, because each finds something the
others miss.

**Full text** (`tsvector @@ websearch_to_tsquery`) catches real words,
including ones buried in a description, tag, or post body that trigrams are
too blunt to reach. Fields are weighted: a name match outranks a summary
match, which outranks a description or tag match.

**Trigram similarity** (`field % query`) catches typos. This is the branch
that makes search feel forgiving: users mistype mod and plugin names
constantly, and "sodim" should find "Sodium". It reads its threshold from
`pg_trgm.similarity_threshold`, pinned to `0.3` by the migration, and
trigram comparison is already case-insensitive, so no `lower()` is needed.

**Substring** (`field ILIKE '%query%'`) catches partial matches. Trigram
similarity does not: "Sodium" scores 0.0 against "ium", because trigrams
compare strings of similar length, while a visitor typing part of a name
wants a substring match. Wildcards are escaped first, so searching for
`100%` does not match every row.

Relevance is the primary sort only when the query is non-empty. An empty
query is a browse view and orders by the chosen sort instead.

## The indexes, and the one thing that will bite you

The two vector expressions are written out in the migration **and** in
`src/lib/search/text.ts`. A GIN expression index is only used when the query
repeats the expression exactly, so the SQL there and the `sql` template here
must stay identical: same functions, same order, same
`'english'::regconfig` casts.

Diverging them does not error. It silently falls back to a sequential scan,
which is why `src/lib/__tests__/search-index.test.ts` asserts index usage.
If you change one, change the other and generate a new migration.

`tags` is a `text[]` and needs `public.immutable_array_to_string` to be
searchable: an index expression may only be immutable, and `array_to_string`
is declared STABLE. The wrapper performs the same computation declared
immutable, which is sound for `text[]` because the result depends only on
its arguments. See the migration for the full reasoning.

## Changing the schema

Generate migrations with `drizzle-kit`; do not hand-edit files in
`drizzle/`. Anything that changes a `tsvector` expression needs a new
migration for the matching index, plus a matching edit in
`src/lib/search/text.ts`.

## Search filters

`searchProjects` accepts:

```ts
{
  type: "mod" | "plugin";
  query: string;
  category?: string;
  gameVersion?: string;
  loader?: string;
  page?: number;
  sort: "downloads:desc" | "updatedAt:desc" | "name:asc";
}
```

Categories, game versions, and loaders are validated against the
allowlists for the given type in `src/lib/projects.ts` before they reach
the query; an unknown value is dropped rather than forwarded. The response
includes `hits`, `estimatedTotalHits`, and `facetDistribution`.

`gameVersions` and `loaders` live on `project_versions`, not `projects`, so
filtering unions them across versions in a CTE. A project with no
published versions left-joins to no facets at all, which is why those two
fields are nullable in a hit.

Only published projects are ever returned: `status = 'published' AND NOT
pendingDeletion` is applied in the query, so an unpublished project cannot
leak through search even if a caller asks for it.

The blog has a single parameter, `query`. `searchPostsAdmin` runs the same
query over drafts as well, and is gated on an admin session.

## When search is hidden

The blog hides its search field when `postSearchAvailable` returns false,
which is the case only when there are no published posts — a search box over
an empty blog is a dead control. Reading the table cannot get this wrong;
there is no index that starts out empty after a fresh deploy.

An unreadable result set degrades to "no matches" rather than throwing, so a
schema mismatch shows an empty listing instead of a 500 and an error
boundary.

## Local setup

Nothing to do. `just infra` starts Postgres and Garage; search works
against the same database as everything else.

## Related

* [Projects and Files](../content/projects.md)
* [Commands](../development/commands.md)
* [Docker](../deployment/docker.md)
* [Architecture](../architecture/overview.md)
