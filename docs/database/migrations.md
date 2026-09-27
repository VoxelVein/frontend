# Database Migrations

VoxelVein uses Drizzle ORM with PostgreSQL. Schema changes are tracked
as SQL migrations in the `drizzle/` directory.

## Configuration

`drizzle.config.ts` points Drizzle at the schema and the database:

```ts
export default defineConfig({
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/db/schema.ts",
});
```

## Generate a migration

After editing `src/db/schema.ts`, generate a new migration:

```bash
./node_modules/.bin/drizzle-kit generate
```

Use the project-local binary. `pnpm dlx drizzle-kit` runs in a fresh
environment and fails with "Please install latest version of
drizzle-orm".

The command writes a new SQL file and snapshot under `drizzle/`, for
example `drizzle/0003_my_change.sql`.

## Apply a migration

Apply pending migrations to the database:

```bash
./node_modules/.bin/drizzle-kit migrate
```

Deployments apply migrations automatically. The `migrate` Docker target
runs `drizzle-kit migrate` as a one-shot Compose service, and the web and
API services only start after it exits successfully. See
[Docker Deployment](../deployment/docker.md).

## Review the SQL

Always review the generated SQL before applying it. Check that:

* New tables have the expected columns and constraints.
* Indexes are created for foreign keys.
* The migration matches the intent of the schema change.

## Schema

The schema lives in `src/db/schema.ts` and currently defines:

Better Auth tables:

* `users` — user accounts, with an optional Markdown `bio` shown on the
  public profile
* `sessions` — auth sessions
* `accounts` — linked social/oauth accounts
* `verifications` — verification tokens
* `passkeys` — WebAuthn passkey credentials

Application tables:

* `posts` — blog posts
* `projects` — mods and plugins, with a `draft` / `pending` /
  `published` / `removed` lifecycle
* `project_versions` — released versions of a project
* `project_files` — uploaded `.jar` files
* `admin_notifications` — the shared admin inbox
* `user_notifications` — per-user notifications, such as the result of a
  publishing review
* `username_history` — previous usernames, to keep them unique

## Journal timestamps decide what runs

`drizzle/meta/_journal.json` orders migrations, and the `when` value is not
cosmetic. The migrator applies a migration only when

```text
newest applied created_at < this migration's folderMillis
```

so a `when` that is **not newer than what has already been applied is skipped
silently** — `pnpm db:migrate` reports success and the schema is quietly wrong.
`when` also has to increase down the journal, because a migration stamped
earlier than its predecessor is never reached once the later one has run.

Two ways this bites:

* **Fabricating a future timestamp.** Writing an entry by hand with a
  rounded-up "next hour" value leaves the journal ahead of the real clock, and
  every migration generated in the meantime is skipped. `0013` was stamped
  28 minutes into the future this way; `0014` was generated inside that window
  and would not have applied.
* **Appending after a hand-written entry.** Always check the new entry's `when`
  against the previous one before committing.

To check a journal, entries must be strictly increasing:

```bash
python3 - <<'PY'
import json

with open("drizzle/meta/_journal.json") as handle:
    stamps = [e["when"] for e in json.load(handle)["entries"]]

print("monotonic:", stamps == sorted(stamps))
PY
```

If a migration has already been applied to a shared database with a wrong
stamp, correcting the journal alone is not enough — the
`drizzle.__drizzle_migrations` ledger still holds the old `created_at`, and the
migrator compares against that. Fix the row to match the corrected journal.

## Data migrations

Drizzle only generates DDL. A migration that changes existing rows has to be
written by hand, and `drizzle/0006_project_files_unique.sql` and
`drizzle/0009_account_lifecycle.sql` both do this alongside their DDL.

`drizzle/0013_queue_published_projects_for_review.sql` is a pure data
migration: it moves every `published` project into the review queue. It is
kept in its own file so the one step that changes what users can see can be
reviewed — and held back — independently of the DDL it depends on.

## Related

* [Setup](../development/setup.md)
* [Architecture Overview](../architecture/overview.md)
