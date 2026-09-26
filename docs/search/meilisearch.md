# Meilisearch Search

Meilisearch powers the `/mods` and `/plugins` pages. The browser never
talks to Meilisearch directly. Search runs through the ElysiaJS API
server, so the search key stays server-side.

Postgres is the source of truth. Meilisearch holds one document per
published project in the `projects` index.

## How it works

* `server/lib/meilisearch.ts` — search client factory used by the API
  server (`getSearchClient`) and the index name (`projects`)
* `server/routes/projects.ts` — `GET /api/projects/search` proxy that
  validates the project type and filters, builds the Meilisearch query,
  and returns hits plus facet counts
* `src/lib/project-search.functions.ts` — `searchProjects` server
  function that calls the API server endpoint
* `src/lib/search-sync.ts` — builds a project's search document from the
  database and writes or removes it after every change
* `scripts/seed-projects.ts` — configures the index and rebuilds it from
  the database (`pnpm db:seed` also creates demo projects first)

## Environment variables

* `MEILI_HOST` — Meilisearch base URL. Defaults to
  `http://localhost:7700`.
* `MEILI_SEARCH_KEY` — search-only key used by the API server.
* `MEILI_ADMIN_KEY` — key used by the web app to write project
  documents. Scope it to `documents.add` and `documents.delete` on the
  `projects` index.
* `MEILI_MASTER_KEY` — only needed by `pnpm db:seed` and
  `pnpm db:reindex`, which change index settings.

Create the scoped write key once with the master key:

```bash
curl -X POST "$MEILI_HOST/keys" \
  -H "Authorization: Bearer $MEILI_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"voxelvein-web-projects-writer",
       "actions":["documents.add","documents.delete"],
       "indexes":["projects"],"expiresAt":null}'
```

Put the returned `key` into `MEILI_ADMIN_KEY`.

## Local setup

`docker-compose.yml` starts Postgres, Meilisearch, and Garage:

```bash
just infra
```

Meilisearch listens on `127.0.0.1:7700`.

## Building the index

```bash
pnpm db:seed      # demo projects + full reindex
pnpm db:reindex   # full reindex only
```

The reindex:

1. Deletes the legacy `mods` index if it still exists
2. Marks `type`, `category`, `gameVersions`, and `loaders` as filterable
3. Marks `name`, `description`, `author`, `tags`, and `category` as
   searchable
4. Marks `downloads`, `updatedAt`, and `name` as sortable
5. Replaces all documents with the published projects from Postgres

## Search endpoint

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

Categories and loaders are validated against the values for the given
type in `src/lib/projects.ts` before they reach Meilisearch. Unknown
values return `422`. The response includes `hits`,
`estimatedTotalHits`, and `facetDistribution`.

The API server must be running for search to work (`pnpm dev:all` starts
it). See [API Server](../architecture/api.md).

## Production instance

The production Meilisearch runs on the VoxelVein server via Dokploy:

* Public URL: `http://website-meilisearch-4c5035-5-175-245-175.sslip.io`
* Image: `getmeili/meilisearch:v1.35.1`
* Port 7700 is not published — the frontend container reaches it over
  the internal `dokploy-network`
* CORS is disabled, which is why search is server-side

To rebuild the production index from the production database, run the
reindex against the public URL with the production master key:

```bash
MEILI_HOST=http://website-meilisearch-4c5035-5-175-245-175.sslip.io \
MEILI_MASTER_KEY=your-master-key \
DATABASE_URL=postgresql://... \
  pnpm db:reindex
```

Do not run `pnpm db:seed` against production; it creates demo projects.

## Related

* [Projects and Files](../content/projects.md)
* [Commands](../development/commands.md)
* [Docker](../deployment/docker.md)
* [Architecture](../architecture/overview.md)
* [API Server](../architecture/api.md)
