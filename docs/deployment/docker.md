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
   port 3000 (override with `PORT`).

Every image runs as a non-root user (`nodejs`).

## Build the images

```bash
docker build --build-arg VITE_API_URL=https://api.example.com \
  --build-arg VITE_SITE_URL=https://example.com -t voxelvein-frontend .
docker build --target api -t voxelvein-api .
docker build --target migrate -t voxelvein-migrate .
```

`VITE_*` values are inlined into the client bundle at build time, so
they are build arguments, and changing one means rebuilding the web
image. The build fails without `VITE_API_URL` (public API URL) or
`VITE_SITE_URL` (public web app URL). `VITE_TURNSTILE_SITE_KEY`,
`VITE_GOOGLE_CLIENT_ID`, and `VITE_GITHUB_CLIENT_ID` are optional.
`compose.yaml` passes all of them through from `.env`, taking the OAuth
client IDs from `GOOGLE_CLIENT_ID` and `GITHUB_CLIENT_ID`.

## Run with Compose

`compose.yaml` defines `db` (Postgres), `migrate`, `web`, `api`, and
`meilisearch`. It is the file Dokploy deploys. `migrate` applies
pending migrations and exits; `web` only starts after it exits
successfully, so a deploy never serves new code against an old schema.
`api` does not use the database and starts independently.

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
```

`migrate`, `web`, and `api` load every variable from `.env` next to the
compose file (Dokploy writes it from the Environment tab). `DATABASE_URL`
defaults to the bundled `db` service; set it only to use an external
database. The web service reaches
the API over the compose network (`API_URL=http://api:3002`). No host
ports are published, so Traefik routes to the containers via Dokploy's
Domains tab. To reach the stack from the host, add
`-f compose.host-ports.yaml`, which publishes the web app on
`${WEB_PORT}` (default 1112) and the API on `${API_HOST_PORT}`
(default 1113).

For a self-contained local stack with Postgres, Meilisearch, and Garage,
use `docker-compose.yml` instead.

## Environment variables

| Variable                    | Used by             | Required    |
| --------------------------- | ------------------- | ----------- |
| `VITE_API_URL`              | web (build arg)     | Yes         |
| `VITE_SITE_URL`             | web (build arg)     | Yes         |
| `BETTER_AUTH_URL`           | web, migrate        | Yes         |
| `BETTER_AUTH_SECRET`        | web, migrate        | Yes         |
| `POSTGRES_PASSWORD`         | db                  | Yes         |
| `MEILI_MASTER_KEY`          | meilisearch         | Yes         |
| `WEBHOOK_SECRET`            | api                 | Yes         |
| `CORS_ORIGIN`               | api                 | Yes         |
| `VITE_TURNSTILE_SITE_KEY`   | web (build arg)     | For sign-in |
| `TURNSTILE_SECRET`          | web                 | For sign-in |
| `TURNSTILE_HOSTNAMES`       | web                 | For sign-in |
| `MEILI_SEARCH_KEY`          | web, api            | No          |
| `MEILI_ADMIN_KEY`           | web                 | No          |
| `STORAGE_*`                 | web                 | For uploads |
| `GOOGLE_CLIENT_ID`/`SECRET` | web (+ build arg)   | No          |
| `GITHUB_CLIENT_ID`/`SECRET` | web (+ build arg)   | No          |
| `TRUST_PROXY`               | web, api            | No          |
| `DATABASE_URL`              | web, migrate        | No          |

`VITE_API_URL` is the public API URL, `CORS_ORIGIN` the web app origin(s)
allowed to call the API, and `TRUST_PROXY` (default `true` in
`compose.yaml`) is covered below. `MEILI_SEARCH_KEY` falls back to
`MEILI_MASTER_KEY`.

Password sign-in and sign-up are rejected unless all three Turnstile
values are set. In production the secret must not be a Cloudflare
testing secret and `TURNSTILE_HOSTNAMES` must not include `localhost`.

`MEILI_ADMIN_KEY` lets the web app keep search in sync. It needs
`documents.add`, `documents.delete`, `indexes.create`, and
`settings.update` on the `projects` and `posts` indexes; without it,
search stays empty. Mint it with the master key after the first deploy
(see [Meilisearch](../search/meilisearch.md)) and redeploy.

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

* [Deploying with Dokploy](dokploy.md)
* [Setup](../development/setup.md)
* [Commands](../development/commands.md)
* [Migrations](../database/migrations.md)
