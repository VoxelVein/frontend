# Local Development Setup

This guide walks through getting the VoxelVein frontend running
locally.

## Prerequisites

* Node.js 24 or newer (pinned in `mise.toml`, the Dockerfile, and CI)
* pnpm 11.3.0, via the `packageManager` field and Corepack
* PostgreSQL 16 or newer (the images use `postgres:18`)
* Docker, for local object storage — optional

## 1. Install dependencies

```bash
pnpm install
```

Or, if you use mise, let it set up the toolchain first:

```bash
mise install
```

## 2. Configure environment variables

Copy the example file and fill in the values. `.env.example` documents
every supported variable; this is the minimum:

| Variable             | Description                              |
| -------------------- | ---------------------------------------- |
| `DATABASE_URL`       | PostgreSQL connection string             |
| `BETTER_AUTH_SECRET` | Session secret (32+)                     |
| `BETTER_AUTH_URL`    | Public URL of the app                    |
| `VITE_SITE_URL`      | Public URL, for OG tags and JSON-LD      |
| `API_URL`            | API URL the web server uses              |
| `VITE_API_URL`       | API URL used by the browser (SSE)        |
| `API_PORT`           | API port (default `3002`)                |
| `WEBHOOK_SECRET`     | Webhook HMAC secret (32+)                |
| `TRUST_PROXY`        | Trust `X-Forwarded-For`; `false` locally |
| `NODE_ENV`           | `development` locally                    |

Everything else is optional and each one disables its own feature when
unset:

| Variable | Enables |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `_SECRET` | Google sign-in |
| `GITHUB_CLIENT_ID` / `_SECRET` | GitHub sign-in |
| `VITE_TURNSTILE_SITE_KEY` | The Turnstile widget |
| `TURNSTILE_SECRET` | Password sign-in and sign-up |
| `TURNSTILE_HOSTNAMES` | Hostname check for the above |
| `STORAGE_*` | File uploads and downloads |
| `ADMIN_EMAIL` | The default account for `db:seed:admin` |
| `PORT` | Where the app listens (3000) |
| `WEB_PORT`, `API_HOST_PORT` | Host ports Docker publishes |
| `SSE_MAX_CONNECTIONS`, `SSE_MAX_CONNECTIONS_PER_IP` | Event-stream caps |

The `VITE_GOOGLE_CLIENT_ID` and `VITE_GITHUB_CLIENT_ID` values are derived
from the server-side `*_CLIENT_ID`, so setting the server values is enough.

Generate secrets with:

```bash
openssl rand -hex 32
```

> Never commit `.env.local`. It is gitignored, and `.env.example` is the
> only env file in the repository.

## 3. Start PostgreSQL

Use an existing PostgreSQL instance or run one with Docker:

```bash
docker run -d \
  --name voxelvein-db \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:18
```

Or start the whole local infrastructure stack, which adds Garage for
object storage and Valkey for rate-limit counters:

```bash
just infra
```

## 4. Apply migrations

```bash
pnpm db:migrate
```

## 5. Optional: prepare object storage

Only needed if you want to upload files. `just infra` already started
Garage; create the bucket and import the access key:

```bash
just storage-init     # or: pnpm storage:init
```

## 6. Optional: seed demo content

Both seeders attach their content to the first admin, so create one first:
sign up on the site, then

```bash
pnpm db:seed:admin you@example.com
```

Then seed demo projects and blog posts:

```bash
pnpm db:seed
```

## 7. Run the dev servers

The web app and the ElysiaJS API server run side by side. Start both with:

```bash
pnpm dev
```

Or run them in separate terminals:

```bash
pnpm dev:web    # web app on http://localhost:3000
pnpm dev:api    # API server on http://localhost:3002
```

`pnpm dev` delegates to `pnpm dev:all`, so the two commands cannot drift
apart. Vite uses `strictPort`, so the app never silently moves to 3001:
the auth origins are pinned to 3000.

## 8. Verify

* `http://localhost:3000` — the homepage renders, with trending projects
  and the news section once content exists.
* `http://localhost:3000/mods` — search works straight from Postgres, with
  filters for category, game version, and loader. The other five browse
  pages behave the same.
* `http://localhost:3000/servers` — the client-requirement filter appears,
  because it is specific to servers.
* `http://localhost:3002/api/health` — the API server responds.
* Send a test mod event and watch the live banner on any browse page:

  ```bash
  pnpm send:webhook mod.created "My Mod"
  ```

* `http://localhost:3000/signup` — create an account, then
  `http://localhost:3000/settings` to manage the profile, username, bio,
  sign-in methods, passkeys, and sessions.
* `http://localhost:3000/dashboard/projects` — the creator dashboard.
  Without object storage configured, the upload step returns `503`.
* `http://localhost:3000/blog` — the blog, with search once a post is
  published.
* `http://localhost:3000/admin` — the admin panel, as an admin.

## Troubleshooting

* **"Could not reach the database"** on a browse page. Search runs in
  Postgres, not the API server, so this means the database is
  unreachable. Check `DATABASE_URL` and that Postgres is running.
* **"Could not reach the server"** on a browse page. That search call was
  the page's request to the app server itself, so the server likely
  restarted mid-session (a deploy); reloading usually clears it.
* **Password sign-in returns `503`** — Turnstile is enabled but
  misconfigured, or unconfigured entirely. The widget is hidden without
  `VITE_TURNSTILE_SITE_KEY` and the endpoint fails closed. See
  [Cloudflare Turnstile](../authentication/turnstile.md).
* **The API server exits at startup** — `WEBHOOK_SECRET` is missing,
  shorter than 32 characters, or still a placeholder value.
* **Uploads return `503`** — storage is not configured. See
  [Object Storage](../storage/object-storage.md).
* **No live banner on a browse page** — `VITE_API_URL` is unset. The
  development fallback is `http://localhost:3002`; a production build has
  no fallback.
* **Port 3000 already in use** — change `PORT` and `BETTER_AUTH_URL`
  together, or stop whatever is on 3000.

## Related

* [Commands](commands.md)
* [Migrations](../database/migrations.md)
* [Google Social Provider](../social-providers/google.md)
* [Object Storage](../storage/object-storage.md)
* [API Server](../architecture/api.md)
