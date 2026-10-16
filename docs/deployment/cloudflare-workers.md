# Deploying to Cloudflare Workers

`wrangler.toml` at the repository root selects the Nitro
`cloudflare_module` preset. Build with the preset set, then deploy:

```bash
NITRO_PRESET=cloudflare_module pnpm build
npx wrangler deploy
```

## Prerequisites

* A PostgreSQL database reachable from Workers (for example, a Neon or
  Hyperdrive binding). Cloudflare Workers do not ship Postgres, so
  `DATABASE_URL` must point at an external database.
* The Elysia API deployed elsewhere, with `VITE_API_URL` pointing at it
  (build-time).

## Bindings

Use Wrangler secrets for sensitive values and expose the rest through the
`[vars]` block in `wrangler.toml`:

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put BETTER_AUTH_SECRET
```

Set `BETTER_AUTH_URL` and `VITE_SITE_URL` to the Worker's public URL and
`VITE_API_URL` to the API's public URL before building.

## Compatibility

Postgres access relies on TCP sockets, so enable `nodejs_compat_v2` (the
flag is already set in `wrangler.toml`). Storage and uploads go through
the separate Elysia API / R2 according to the
[object storage guide](../storage/object-storage.md).

## Cron triggers

The hourly account purge is a Nitro scheduled task. With the
`cloudflare_module` preset Nitro generates the matching Cron Trigger in
the Wrangler config at build time, so no manual trigger configuration is
needed.
