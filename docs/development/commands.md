# Commands Reference

All commands are run with pnpm. Linting and formatting use Ultracite on
top of Oxlint and Oxfmt.

## Development

| Command             | Description                              |
| ------------------- | ---------------------------------------- |
| `pnpm dev`          | Start the dev server on port 3000        |
| `pnpm dev:api`      | Start the ElysiaJS API server (watch)    |
| `pnpm dev:all`      | Run the app and API server together      |
| `pnpm start:api`    | Start the API server (no watch)          |
| `pnpm send:webhook` | Send a test mod webhook to the API       |
| `pnpm build`        | Build the production bundle              |
| `pnpm preview`      | Preview the production build             |
| `pnpm start`        | Run the built server from `.output/`     |

## Quality

| Command             | Description                          |
| ------------------- | ------------------------------------ |
| `pnpm check`        | Lint + format check (read-only)      |
| `pnpm fix`          | Lint + auto-fix issues               |
| `pnpm typecheck`    | TypeScript type checking             |
| `pnpm test`         | Run the Vitest suite                 |
| `pnpm test:coverage`| Run the Vitest suite with coverage   |
| `pnpm lint`         | Run Oxlint only                      |
| `pnpm lint:md`      | Run markdownlint on Markdown files   |
| `pnpm lint:md:fix`  | Auto-fix Markdown issues             |
| `pnpm format`       | Format source files with Oxfmt       |

## Database

| Command                                        | Description           |
| ---------------------------------------------- | --------------------- |
| `./node_modules/.bin/drizzle-kit generate`     | Generate a migration  |
| `./node_modules/.bin/drizzle-kit migrate`      | Apply migrations      |

Use the project-local Drizzle binary; `pnpm dlx drizzle-kit` fails in
a fresh environment.

## Content and search

| Command             | Description                                     |
| ------------------- | ----------------------------------------------- |
| `just infra`        | Start Postgres, Meilisearch, and Garage         |
| `pnpm storage:init` | Prepare the local Garage bucket and key         |
| `pnpm db:seed`      | Create demo mods and plugins, then reindex      |
| `pnpm db:reindex`   | Rebuild the search index from the database      |
| `pnpm db:seed:admin`| Make an existing user an admin                  |

See [Object Storage](../storage/object-storage.md) and
[Projects and Files](../content/projects.md).

## Tooling

| Command                     | Description                          |
| --------------------------- | ------------------------------------ |
| `pnpm dlx ultracite doctor` | Diagnose lint/format setup issues    |

## Git hooks

A Husky pre-commit hook runs `ultracite fix` automatically. It formats
the working tree and re-stages files, so code is clean before it
reaches the hook.

## Related

* [Setup](setup.md)
* [Migrations](../database/migrations.md)
* [API Server](../architecture/api.md)
