# Commands Reference

All commands are run with pnpm. Linting and formatting use Ultracite on
top of Oxlint and Oxfmt. Every script below wraps the same pnpm script
you would otherwise type.

## Development

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | Start the whole dev environment (app + API)  |
| `pnpm dev:all`      | Same thing; `dev` delegates here             |
| `pnpm dev:web`      | Start only the Vite app (port 3000)          |
| `pnpm dev:api`      | Start the ElysiaJS API server (watch)        |
| `pnpm start:api`    | Start the API server (no watch)              |
| `pnpm send:webhook` | Send a test mod webhook to the API           |
| `pnpm build`        | Build the production bundle                  |
| `pnpm preview`      | Preview the production build                 |
| `pnpm start`        | Run the built Nitro server from `.output/`   |
| `pnpm check:bundle` | Check the main chunk against the size budget |

`pnpm check:bundle` builds first; pass `--no-build` to reuse an existing
build. The budget is 700 kB raw and 250 kB gzipped for the largest
`index-*.js`.

## Quality

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `pnpm check`         | Lint + format check (read-only)    |
| `pnpm fix`           | Lint + auto-fix issues             |
| `pnpm typecheck`     | TypeScript type checking           |
| `pnpm test`          | Run the Vitest suite               |
| `pnpm test:coverage` | Run the Vitest suite with coverage |
| `pnpm lint`          | Run Oxlint only                    |
| `pnpm lint:md`       | Run markdownlint on Markdown files |
| `pnpm lint:md:fix`   | Auto-fix Markdown issues           |
| `pnpm format`        | Format source files with Oxfmt     |

## Database

| Command           | Description              |
| ----------------- | ------------------------ |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio`  | Open Drizzle Studio      |
| `pnpm db:check`   | Verify schema/migrations |

To generate a migration, use the project-local Drizzle binary:

```bash
./node_modules/.bin/drizzle-kit generate
```

There is deliberately no `db:generate` script, and
`pnpm dlx drizzle-kit` runs in a fresh environment and fails with
"Please install latest version of drizzle-orm".

`pnpm db:check` runs `generate` and fails if it produces a migration, which
means `src/db/schema.ts` changed without one. It needs no database, so it is
cheap to run locally before pushing, and CI runs it on every build.

See [Migrations](../database/migrations.md) for how to name, review, and
apply a migration.

## Content and infrastructure

| Command                 | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `pnpm db:seed`          | Seed demo projects and blog posts              |
| `pnpm db:seed:projects` | Seed demo projects of every type               |
| `pnpm db:seed:posts`    | Seed demo blog posts                           |
| `pnpm db:seed:admin`    | Promote an existing user to admin              |
| `pnpm mc:versions`      | Refresh the Minecraft version list from Mojang |
| `pnpm storage:init`     | Prepare the local Garage bucket and key        |
| `just infra`            | Start Postgres and Garage with Docker          |
| `just docker-dev`       | Run the app in Docker with hot reload          |
| `just docker-prod`      | Build and run the production Compose stack     |

`db:seed:admin` takes the email as an argument, or reads `ADMIN_EMAIL`:

```bash
pnpm db:seed:admin you@example.com
```

The seeders attach their content to the first admin, so run it first. See
[Object Storage](../storage/object-storage.md) and
[Projects and Files](../content/projects.md).

## Tooling

| Command                     | Description                       |
| --------------------------- | --------------------------------- |
| `pnpm dlx ultracite doctor` | Diagnose lint/format setup issues |

## Docker

All three use the same base file plus an override:

| Override | Result |
| --- | --- |
| `compose.dev.yaml` | App with hot reload |
| `compose.prod.yaml` | Production stack |
| `compose.prod.yaml` + `compose.host-ports.yaml` | With host ports |

```bash
docker compose -f compose.yaml -f compose.dev.yaml up
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
docker compose -f compose.yaml -f compose.prod.yaml \
  -f compose.host-ports.yaml up -d
```

The `compose.yaml` stack publishes no host ports, so Dokploy's Traefik can
route to the containers directly. The dev override publishes `1112` for
the Vite server and `3002` for the API. See
[Docker Deployment](../deployment/docker.md).

## CI

The gate is defined once, in the reusable workflow
`.github/workflows/_quality.yml`, and is called by `main.yml`, `pr.yml`, and
`deploy.yml`. It runs:

* `pnpm check` for lint and format
* `pnpm typecheck` for types
* `pnpm lint:md` for Markdown
* `pnpm audit --audit-level high` for known vulnerabilities (non-blocking, so
  an advisory does not block unrelated work)
* `pnpm db:check` to confirm the schema and migrations agree
* `pnpm test`, `pnpm build`, and `pnpm check:bundle --no-build`

`_docker.yml` is likewise reusable, and builds the runtime image with
`push: false` on main and pull requests, so the Dockerfile is checked without
needing registry credentials.

`docs.yml` runs `pnpm lint:md` and `pnpm docs:check`, the latter verifying
that every relative link and heading anchor resolves.

`main.yml` and `pr.yml` skip everything except docs for Markdown-only
changes. `deploy.yml` additionally pushes the web, API, and migrate images
with provenance and SBOM attestations.

The migration check needs no database, but `drizzle.config.ts` validates its
environment on import, so the workflow supplies a placeholder
`DATABASE_URL`, a `BETTER_AUTH_SECRET` of at least 32 characters, and
`BETTER_AUTH_URL`.

## Git hooks

A Husky pre-commit hook runs `ultracite fix` automatically. It formats
the working tree and re-stages files, so code is clean before it
reaches the hook.

## Related

* [Setup](setup.md)
* [Migrations](../database/migrations.md)
* [Docker Deployment](../deployment/docker.md)
* [API Server](../architecture/api.md)
