# Deploying on Netlify

`netlify.toml` at the repository root selects the Nitro `netlify`
preset: the build runs `pnpm build`, publishes `.output/public`, and
deploys the server as a Netlify Function.

## Prerequisites

* A PostgreSQL database reachable from Netlify Functions.
* The Elysia API deployed elsewhere; set `VITE_API_URL` to its public URL
  (build-time).

## Configuration

Set the variables in the Netlify site settings. Values prefixed with
`VITE_` are baked into the bundle at build time.

* `VITE_API_URL`  -  public URL of the Elysia API (build-time)
* `VITE_SITE_URL`  -  public URL of the web app (build-time)
* `DATABASE_URL`  -  runtime connection string
* `BETTER_AUTH_SECRET`  -  32+ characters (runtime)
* `BETTER_AUTH_URL`  -  same as `VITE_SITE_URL` (runtime)
* `VALKEY_URL`  -  optional; omit to disable shared rate limits

`NITRO_PRESET=netlify` is set through `netlify.toml`.

## Caveats

Netlify Functions run with a fixed execution limit; the home page loader
and project search stay within it, but long uploads or SSE are served by
the separate Elysia API, which is unaffected.
