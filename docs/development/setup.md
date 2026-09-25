# Local Development Setup

This guide walks through getting the VoxelVein frontend running
locally.

## Prerequisites

* Node.js 24 or newer
* pnpm 11 (managed via Corepack)
* PostgreSQL 16 or newer

## 1. Install dependencies

```bash
pnpm install
```

## 2. Configure environment variables

Copy the example file and fill in the values:

```bash
cp .env.example .env.local
```

Required variables:

| Variable             | Description                          |
| -------------------- | ------------------------------------ |
| `DATABASE_URL`       | PostgreSQL connection string         |
| `BETTER_AUTH_SECRET` | Secret for signing sessions (32+)    |
| `BETTER_AUTH_URL`    | Public URL of the app                |
| `MEILI_HOST`         | Meilisearch base URL                 |
| `MEILI_SEARCH_KEY`   | Meilisearch search key               |
| `API_URL`            | API server base URL                  |
| `API_PORT`           | API server port (default `3002`)     |
| `WEBHOOK_SECRET`     | Webhook HMAC secret (32+, required)  |
| `VITE_API_URL`       | API base URL used by the browser     |

Optional variables:

| Variable                    | Description                       |
| --------------------------- | --------------------------------- |
| `GOOGLE_CLIENT_ID`          | Google OAuth client ID            |
| `GOOGLE_CLIENT_SECRET`      | Google OAuth client secret        |
| `VITE_GOOGLE_CLIENT_ID`     | Google OAuth client ID (client)   |
| `GITHUB_CLIENT_ID`          | GitHub OAuth client ID            |
| `GITHUB_CLIENT_SECRET`      | GitHub OAuth client secret        |
| `VITE_GITHUB_CLIENT_ID`     | GitHub OAuth client ID (client)   |
| `MEILI_MASTER_KEY`          | Meilisearch admin key (seeding)   |
| `MEILI_ADMIN_KEY`           | Meilisearch project write key     |
| `STORAGE_*`                 | Object storage (file uploads)     |
| `VITE_QUACKBACK_WIDGET_KEY` | Feedback widget key (optional)    |
| `PORT`                      | Web server port (default `3000`)  |

Generate secrets with:

```bash
openssl rand -base64 32
```

## 3. Start PostgreSQL

Use an existing PostgreSQL instance or run one with Docker:

```bash
docker run -d \
  --name voxelvein-db \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16
```

## 4. Apply migrations

```bash
./node_modules/.bin/drizzle-kit migrate
```

## 5. Run the dev servers

The web app and the ElysiaJS API server run side by side. Start both with:

```bash
pnpm dev
```

Or run them in separate terminals:

```bash
pnpm dev:web    # web app on http://localhost:3000
pnpm dev:api    # API server on http://localhost:3002
```

## 6. Verify

* Open `http://localhost:3000` — the homepage renders.
* Open `http://localhost:3000/projects` — the projects hub links to the
  mods page.
* Open `http://localhost:3000/mods` — search is real-time and results come
  through the API server.
* Open `http://localhost:3002/api/health` — the API server responds.
* Send a test mod event and watch the live banner on the mods page:

  ```bash
  pnpm send:webhook mod.created "My Mod"
  ```

* Open `http://localhost:3000/signup` — create an account.
* Open `http://localhost:3000/settings` — manage profile, passkeys,
  and sessions.

## Related

* [Commands](commands.md)
* [Migrations](../database/migrations.md)
* [Google Social Provider](../social-providers/google.md)
* [API Server](../architecture/api.md)
