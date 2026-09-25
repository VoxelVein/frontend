# Docker Deployment

The repository ships a multi-stage `Dockerfile` that builds and runs
the production server.

## Build the image

```bash
docker build -t voxelvein-frontend .
```

The build has three stages:

1. **deps** — installs dependencies with `pnpm install
   --frozen-lockfile`.
2. **build** — runs `pnpm build`, producing the Nitro output in
   `.output/`.
3. **runtime** — copies only `.output/` and runs the server as a
   non-root user.

## Run the container

```bash
docker run -d \
  --name voxelvein \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e BETTER_AUTH_SECRET=your-secret \
  -e BETTER_AUTH_URL=https://example.com \
  voxelvein-frontend
```

The container listens on port 3000 and exposes a health check at `/`.

## Environment variables

| Variable                | Required | Description                       |
| ----------------------- | -------- | --------------------------------- |
| `DATABASE_URL`          | Yes      | PostgreSQL connection string      |
| `BETTER_AUTH_SECRET`    | Yes      | Secret for signing sessions       |
| `BETTER_AUTH_URL`       | Yes      | Public URL of the app             |
| `GOOGLE_CLIENT_ID`      | No       | Google OAuth client ID            |
| `GOOGLE_CLIENT_SECRET`  | No       | Google OAuth client secret        |

## Production notes

* Set `BETTER_AUTH_URL` to the public HTTPS origin. OAuth redirect
  URIs and the WebAuthn relying party ID are derived from it.
* Use a secrets manager or Docker secrets instead of plain environment
  variables for `BETTER_AUTH_SECRET` and the OAuth secrets.
* The image runs as a non-root user (`nodejs`) for security.

## Related

* [Setup](../development/setup.md)
* [Commands](../development/commands.md)
