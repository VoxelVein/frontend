# Deploying on Vercel

The `vercel.json` at the repository root selects the Nitro `vercel`
preset. Vercel builds the project with `pnpm build` and serves the
Nitro server output as Vercel Functions plus the static assets.

## Prerequisites

* A PostgreSQL database reachable from Vercel's network. The bundled
  `db` service in `compose.yaml` is not available there; use a managed
  Postgres such as Neon, Supabase, or Railway.
* The Elysia API (`server/`) deployed separately (see
  [Docker](docker.md)). Vercel only hosts the web Nitro app. Set
  `VITE_API_URL` to its public URL before building.

## Configuration

Set these in the Vercel project settings. Variables marked build-time
are baked into the bundle, so changing them needs a new deploy.

* `VITE_API_URL`, public URL of the Elysia API (build-time)
* `VITE_SITE_URL`, public URL of the web app (build-time)
* `VITE_TURNSTILE_SITE_KEY`, optional (build-time)
* `DATABASE_URL`, managed Postgres connection string (runtime)
* `BETTER_AUTH_SECRET`, 32+ characters (runtime)
* `BETTER_AUTH_URL`, same as `VITE_SITE_URL` (runtime)
* `VALKEY_URL`, managed Valkey/Redis, or omit (runtime)

Set `NITRO_PRESET=vercel` in the build environment as well; `vercel.json`
already supplies it. Environment variables marked build-time are baked
into the bundle, so changing them needs a new deploy.

## Cron jobs

The hourly account purge is exported as a Nitro scheduled task, and the
`vercel` preset turns it into a Vercel Cron Job automatically. No extra
`vercel.json` cron entry is required. Set `CRON_SECRET` to protect the
job endpoint in production.
