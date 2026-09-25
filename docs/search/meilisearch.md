# Meilisearch Search

Meilisearch powers the `/mods` page. The frontend never talks to
Meilisearch directly from the browser — search runs through the
ElysiaJS API server so the search key stays server-side.

## How it works

* `server/lib/meilisearch.ts` — Meilisearch client factory used by the
  API server (`getSearchClient`) and the index name (`mods`)
* `server/routes/mods.ts` — `GET /api/mods/search` proxy that validates
  filters, builds the Meilisearch query, and returns hits plus facet
  counts
* `src/lib/mods.functions.ts` — `searchMods` client-side helper that
  calls the API server endpoint
* `src/lib/mods-data.ts` — the hard-coded example mods used to seed the
  index
* `scripts/seed-mods.ts` — creates the index, configures filterable /
  searchable / sortable attributes, and uploads the example mods

## Environment variables

* `MEILI_HOST` — Meilisearch base URL. Defaults to
  `http://localhost:7700`.
* `MEILI_MASTER_KEY` — admin key, only needed when seeding.
* `MEILI_SEARCH_KEY` — public search key used by the API server.

The master key is only needed when running the seed script. The running
app only needs the search key.

## Local setup

The root `docker-compose.yml` starts Postgres, Meilisearch, and the web
app together:

```bash
MEILI_MASTER_KEY=your-master-key MEILI_SEARCH_KEY=your-search-key \
  docker compose up --build
```

Meilisearch is exposed on port 7700. The web app reaches it at
`http://meilisearch:7700` inside the compose network.

## Seeding the index

```bash
MEILI_HOST=http://localhost:7700 \
MEILI_MASTER_KEY=your-master-key \
  pnpm db:seed
```

The script:

1. Creates the `mods` index
2. Marks `category`, `gameVersions`, and `loaders` as filterable
3. Marks `name`, `description`, `author`, `tags`, and `category` as
   searchable
4. Marks `downloads`, `updatedAt`, and `name` as sortable
5. Uploads the 12 example mods from `src/lib/mods-data.ts`

Re-running the script is safe — documents are upserted by `id`.

## Search endpoint

`searchMods` accepts a validated payload:

```ts
{
  query: string;
  category: string;
  gameVersion: string;
  loader: string;
  sort: "downloads:desc" | "updatedAt:desc" | "name:asc";
}
```

Filters are validated against the known values in `mods-data.ts` before
reaching Meilisearch, so arbitrary filter strings are rejected. The
response includes `hits`, `estimatedTotalHits`, and `facetDistribution`
for the filter dropdowns.

The API server must be running for search to work (`pnpm dev:all` starts
it). See [API Server](../architecture/api.md).

## Production instance

The production Meilisearch runs on the VoxelVein server via Dokploy:

* Public URL: `http://website-meilisearch-4c5035-5-175-245-175.sslip.io`
* Image: `getmeili/meilisearch:v1.35.1`
* Port 7700 is not published — the frontend container reaches it over
  the internal `dokploy-network`
* CORS is disabled, which is why search is server-side

To seed the production instance, point the seed script at the public
URL with the production master key:

```bash
MEILI_HOST=http://website-meilisearch-4c5035-5-175-245-175.sslip.io \
MEILI_MASTER_KEY=your-master-key \
  pnpm db:seed
```

## Related

* [Commands](../development/commands.md)
* [Docker](../deployment/docker.md)
* [Architecture](../architecture/overview.md)
* [API Server](../architecture/api.md)
