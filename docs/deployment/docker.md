# Docker Deployment

The repository ships one multi-stage `Dockerfile` that produces three
images: the web app, the Elysia API server, and a one-shot migration
runner.

## Build targets

| Target    | Image       | Runs                          |
| --------- | ----------- | ----------------------------- |
| `runtime` | web         | Nitro server (default target) |
| `api`     | API server  | `server/index.ts` via `tsx`   |
| `migrate` | migrations  | `drizzle-kit migrate`, exits  |

The stages are:

1. **deps** — installs dependencies with `pnpm install
   --frozen-lockfile`.
2. **migrate** — `node_modules`, `drizzle.config.ts`, `env.config.ts`,
   and the `drizzle/` migrations. Applies pending migrations and exits.
3. **api** — `node_modules`, `server/`, and `src/lib/`. Runs the API
   on port 3002.
4. **build** — runs `pnpm build`, producing the Nitro output in
   `.output/`. Requires the `VITE_API_URL` build argument.
5. **runtime** — copies only `.output/` and runs the web server on
   port 6001.

Every image runs as a non-root user (`nodejs`).

## Build the images

```bash
docker build --build-arg VITE_API_URL=https://api.example.com \
  -t voxelvein-frontend .
docker build --target api -t voxelvein-api .
docker build --target migrate -t voxelvein-migrate .
```

`VITE_API_URL` is the public URL browsers use to reach the API. Vite
inlines it into the client bundle at build time, so the web image build
fails without it, and changing it means rebuilding the web image.
`compose.yaml` passes it through from `.env` as a build argument, so under
Dokploy set `VITE_API_URL` in the Environment tab.

## Run with Compose

`compose.yaml` defines `migrate`, `api`, and `web`. `migrate` runs first;
`api` and `web` only start after it exits successfully, so a deploy never
serves new code against an old schema.

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
```

The services read their runtime settings from `.env` next to the compose
file (Dokploy writes it from the Environment tab). The web service reaches
the API over the compose network (`API_URL=http://api:3002`). The
production override publishes the web app on `${WEB_PORT}` (default 1112)
and the API on `${API_HOST_PORT}` (default 1113).

For a self-contained local stack with Postgres, Meilisearch, and Garage,
use `docker-compose.yml` instead.

## Environment variables

| Variable               | Used by           | Required |
| ---------------------- | ----------------- | -------- |
| `VITE_API_URL`         | web (build arg)   | Yes      |
| `DATABASE_URL`         | web, migrate      | Yes      |
| `BETTER_AUTH_SECRET`   | web, migrate      | Yes      |
| `BETTER_AUTH_URL`      | web, migrate      | Yes      |
| `MEILI_HOST`           | web, api          | Yes      |
| `MEILI_SEARCH_KEY`     | web, api          | Yes      |
| `WEBHOOK_SECRET`       | api               | Yes      |
| `CORS_ORIGIN`          | api               | Yes      |
| `TRUST_PROXY`          | web, api          | Yes      |
| `GOOGLE_CLIENT_ID`     | web               | No       |
| `GOOGLE_CLIENT_SECRET` | web               | No       |

`VITE_API_URL` is the public API URL, `CORS_ORIGIN` the web app origin(s)
allowed to call the API, and `TRUST_PROXY` is covered below.

`migrate` needs `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` because
`drizzle.config.ts` loads `env.config.ts`, which validates them.

## Client IPs and `TRUST_PROXY`

The API limits event streams per client, and the web app counts a
download once per client and file. Both identify the client by IP from
`X-Forwarded-For`, using the **last** entry — the one the reverse proxy
appends. That is only trustworthy when a proxy you control sits in front
and appends to the header rather than passing a client-supplied one
through unchanged.

* `compose.yaml` defaults `TRUST_PROXY` to `true`, for Traefik in front.
* `docker-compose.yml` publishes ports directly with no proxy and
  defaults it to `false`.
* With `NODE_ENV=production`, the API refuses to start unless
  `TRUST_PROXY` is explicitly `true` or `false`.

## Production notes

* Set `BETTER_AUTH_URL` to the public HTTPS origin. OAuth redirect
  URIs and the WebAuthn relying party ID are derived from it.
* Use a secrets manager or Docker secrets instead of plain environment
  variables for `BETTER_AUTH_SECRET` and the OAuth secrets.
* The deploy workflow pushes `ghcr.io/<repo>`, `ghcr.io/<repo>-api`, and
  `ghcr.io/<repo>-migrate`, each tagged with the `package.json` version
  and the commit SHA. Set the `VITE_API_URL` repository variable in
  GitHub; the workflow fails without it.

## Related

* [Setup](../development/setup.md)
* [Commands](../development/commands.md)
* [Migrations](../database/migrations.md)
