# Docker Deployment

The repository ships one multi-stage `Dockerfile` that produces three
images: the web app, the Elysia API server, and a one-shot migration
runner. All of them are built on `node:24-alpine`.

## Build targets

| Target    | Image      | Runs                          |
| --------- | ---------- | ----------------------------- |
| `runtime` | web        | Nitro server (default target) |
| `api`     | API server | `server/index.ts` via `tsx`   |
| `migrate` | migrations | `drizzle-kit migrate`, exits  |
| `deps`    | dev only   | Dependencies, no build        |

The stages are:

1. **deps** — enables Corepack and installs dependencies with `pnpm install
   --frozen-lockfile`.
2. **migrate** — `node_modules`, `drizzle.config.ts`, `env.config.ts`,
   `drizzle/`, and `src/db/`. Applies pending migrations and exits. It
   needs `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` too, because
   `drizzle.config.ts` imports the validated `env.config.ts`.
3. **api** — `node_modules`, `server/`, `tsconfig.json`, and the whole of
   `src/lib/`. Runs the API on port 3002 with a `/api/health` healthcheck.
4. **build** — runs `pnpm build`, producing the Nitro output in
   `.output/`. Requires the `VITE_API_URL` and `VITE_SITE_URL` build
   arguments.
5. **runtime** — copies only `.output/` and runs the web server on
   port 3000 (override with `PORT`) with a `/` healthcheck.

Every image runs as a non-root user (`nodejs`).

The order is deliberate: `migrate` and `api` come **before** the
`build` stage that needs `VITE_*` arguments, so a legacy builder that runs
every stage is never asked for a build argument it does not have, while a
plain `docker build .` still produces the web image.

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

`compose.yaml` defines `db` (Postgres), `valkey`, `migrate`, `web`, and
`api`. It is the file Dokploy deploys. `migrate` applies
pending migrations and exits; `web` only starts after it exits
successfully, so a deploy never serves new code against an old schema.
`api` does not use the database. Both `web` and `api` wait for `valkey`
to be healthy, since both enforce rate limits through it.

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

For a self-contained local stack with Postgres and Garage, use
`docker-compose.yml` instead.

## Environment variables

| Variable                    | Used by       | Required      |
| --------------------------- | ------------- | ------------- |
| `VITE_API_URL`              | web (build)   | Yes           |
| `VITE_SITE_URL`             | web (build)   | Yes           |
| `BETTER_AUTH_URL`           | web, migrate  | Yes           |
| `BETTER_AUTH_SECRET`        | web, migrate  | Yes           |
| `POSTGRES_PASSWORD`         | db            | Yes           |
| `WEBHOOK_SECRET`            | api           | Yes           |
| `CORS_ORIGIN`               | api           | Has default   |
| `VITE_TURNSTILE_SITE_KEY`   | web (build)   | For sign-in   |
| `TURNSTILE_SECRET`          | web           | For sign-in   |
| `TURNSTILE_HOSTNAMES`       | web           | For sign-in   |
| `STORAGE_*`                 | web           | For uploads   |
| `GOOGLE_CLIENT_ID`/`SECRET` | web (+ build) | No            |
| `GITHUB_CLIENT_ID`/`SECRET` | web (+ build) | No            |
| `TRUST_PROXY`               | web, api      | In production |
| `VALKEY_URL`                | web, api      | In production |
| `VALKEY_MAXMEMORY`          | valkey        | No            |
| `DATABASE_URL`              | web, migrate  | No            |
| `TAG`                       | all           | No            |
| `WEB_PORT`, `API_HOST_PORT` | host ports    | No            |

`VITE_API_URL` is the public API URL, `CORS_ORIGIN` the web app origin(s)
allowed to call the API, and `TRUST_PROXY` (default `true` in
`compose.yaml`) is covered below. `CORS_ORIGIN` defaults to
`https://voxelvein.vomlabs.com` in `compose.yaml`; set it explicitly for
any other domain.

## Valkey

`compose.yaml` ships a `valkey` service. **Valkey, not Redis**: it is the
BSD-licensed Linux Foundation fork, and it speaks the same wire protocol,
so the client is the standard `redis` package and nothing in the code
knows which server it is talking to.

It holds rate-limit counters and nothing else, and it has to be shared:
`web` and `api` both enforce limits, so a per-process counter would be
enforced separately by each replica, multiplying the real limit by the
number of them. See [Hardening](../security/hardening.md).

No volume, persistence off
: Every key carries a TTL, so the contents are disposable. Losing them on
  a restart costs a momentary reset of the limits and nothing else, which
  is not worth a volume and a backup policy.

`--maxmemory 128mb`, `--maxmemory-policy volatile-lru`
: A ceiling so a runaway client cannot grow the heap without bound.
  `volatile-lru` evicts only keys that have an expiry set, so it can
  never drop a key the app expects to persist. Raise it with
  `VALKEY_MAXMEMORY`.

No published port
: Reachable only from the compose network, the same trust boundary as
  everything else in `compose.yaml`. `docker-compose.yml` publishes
  `127.0.0.1:${VALKEY_PORT}` for local `valkey-cli` poking.

No password
: Defensible only because of the above. Nothing outside the compose
  network can reach it and the data is disposable counters. **If you ever
  publish the port, set a password first.**

`VALKEY_URL` defaults to `redis://valkey:6379`, so the bundled stack needs
no configuration; set it to use a managed instance instead. In production
the app refuses to start without it, for the same reason `TRUST_PROXY` is
mandatory there: a silent fallback to a loopback default would leave every
replica enforcing its own limit while looking like it worked.

Password sign-in and sign-up are rejected unless all three Turnstile
values are set. In production the secret must not be a Cloudflare
testing secret and `TURNSTILE_HOSTNAMES` must not include `localhost`.

## Client IPs behind a reverse proxy

Rate limits key anonymous callers by IP, and the API limits event
streams per client while the web app counts a download once per client
and file. All of them identify the client by IP from
`X-Forwarded-For`, using the **last** entry — the one the reverse proxy
appends. That is only trustworthy when a proxy you control sits in front
and appends to the header rather than passing a client-supplied one
through unchanged, which is what `TRUST_PROXY` switches on.

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
* The deploy workflow pushes the web, API, and migration images to
  `ghcr.io/<repo>`, each tagged with the `package.json` version and the
  commit SHA — deliberately with no floating `latest`, so a roll-forward
  is explicit. It fails unless both the `VITE_API_URL` and `VITE_SITE_URL`
  repository variables are set.
* Set the image tag with `TAG` when building locally, otherwise Compose
  uses `latest`.
* `migrate`, `web`, and `api` all read `.env` next to the compose file,
  never `.env.local`.

## Before you go live

Four things are hardcoded or unconfigured in the repository. None of them
break a deploy, and all of them are visible to the public.

**There is no admin on a fresh database.** Nothing bootstraps the first
one, so `/admin` redirects to sign-in until a role is set by hand. See
[Create the First Admin](../authentication/first-admin.md).

**The legal operator is a placeholder.** `src/routes/legal.tsx:5` sets
`OPERATOR` to `name: "Unknown"` and `address: "Unknown"`, and `/legal`
renders both, alongside the § 5 DDG responsible-party details. That page
cannot go live as-is. The email is the only real value.

**The legal page dates are hardcoded.** Each of `/legal`, `/privacy`,
`/terms`, `/disclaimer`, and `/cookies` passes its own `updated` date as a
literal. Editing the text does not update the date, so there is nothing keeping
the two in sync. (`/terms-of-use` no longer renders a page — it redirects to
`/terms`.)

**Cookie consent is recorded but not enforced.** The banner stores
`accepted` or `declined` in `localStorage` under `voxelvein-cookie-consent`
and nothing reads it back. That is consistent with the code today — there
is no analytics, no third-party script, and no non-essential cookie, so
there is nothing to gate. It is only worth knowing because the banner
offers a choice that currently has no consequence, so adding a tracker
later means wiring the gate up, not just adding the script.

If the app is reachable at more than one origin, set
`BETTER_AUTH_TRUSTED_ORIGINS` to a comma-separated list. See
[Hardening](../security/hardening.md).

## Related

* [Deploying with Dokploy](dokploy.md)
* [Setup](../development/setup.md)
* [Commands](../development/commands.md)
* [Object Storage](../storage/object-storage.md)
* [Migrations](../database/migrations.md)
* [Hardening](../security/hardening.md) — response headers and CSRF scope
* [Resilience](../development/resilience.md) — chunk reload and download
  counting
