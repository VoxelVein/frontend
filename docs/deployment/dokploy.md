# Deploying with Dokploy

`compose.yaml` is a self-contained stack for Dokploy: Postgres,
migrations, the web app, and the API. See [Docker](docker.md) for how the
images and services fit together.

## 1. Create the app

1. In your Dokploy project, create a **Docker Compose** app.
2. Point it at this repository, branch `main`, compose path
   `./compose.yaml`.

## 2. Set the environment

Paste into the **Environment** tab. Generate each secret with the
command in the comment. Keep `POSTGRES_PASSWORD` hex-only, since it is
placed inside a database URL.

```bash
# Public URLs (no trailing slash)
VITE_SITE_URL=https://voxelvein.vomlabs.com
VITE_API_URL=https://api.voxelvein.vomlabs.com
BETTER_AUTH_URL=https://voxelvein.vomlabs.com
CORS_ORIGIN=https://voxelvein.vomlabs.com

# Secrets
BETTER_AUTH_SECRET=   # openssl rand -hex 32
POSTGRES_PASSWORD=    # openssl rand -hex 24
WEBHOOK_SECRET=       # openssl rand -hex 32

# Cloudflare Turnstile (real keys; password sign-in fails without them)
VITE_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET=
TURNSTILE_HOSTNAMES=voxelvein.vomlabs.com

# Cloudflare R2 (needed for uploads)
STORAGE_ENDPOINT=https://<account>.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_FORCE_PATH_STYLE=false
STORAGE_BUCKET=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
```

Optional: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and
`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` (callback URL
`<VITE_SITE_URL>/api/auth/callback/<google|github>`),
`STORAGE_PUBLIC_URL`, `STORAGE_QUOTA_BYTES`, and `DATABASE_URL` to use
an external database instead of the bundled one. The full list is in
[Docker](docker.md#environment-variables).

`VITE_*` values are baked in at build time. Changing one needs a
redeploy that rebuilds the images.

## 3. Add the domains

In the **Domains** tab, with HTTPS (Let's Encrypt) enabled:

| Host                        | Service | Port |
| --------------------------- | ------- | ---- |
| `voxelvein.vomlabs.com`     | `web`   | 3000 |
| `api.voxelvein.vomlabs.com` | `api`   | 3002 |

The API needs its own public domain because browsers call it directly.

## 4. Deploy

Click **Deploy**. `db` starts first, `migrate` applies the database
migrations and exits, then `web` starts. `api` starts independently.

Search needs no separate step: `migrate` creates the extension and
indexes, and search works as soon as there is something to find. See
[Search](../search/postgres.md).

## 5. Afterwards

* Set up volume backups for `pgdata`.
* To make yourself admin, sign up on the site, then open the Dokploy
  terminal on the `db` container and run:

  ```bash
  psql -U voxelvein -c "UPDATE users SET role = 'admin' WHERE email = 'you@example.com'"
  ```

* The GitHub `prod` deploy workflow needs the `VITE_API_URL` and
  `VITE_SITE_URL` repository variables.
