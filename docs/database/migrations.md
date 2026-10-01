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

The command writes a new SQL file and snapshot under `drizzle/`, numbered
after the highest existing one — for example `drizzle/0016_my_change.sql`.
Name the file yourself to something readable; Drizzle's generated names
(`0016_wise_hopper.sql`) are fine to keep, but this repository's recent
migrations use descriptive names like `0014_add_user_bio.sql` because
they describe intent that the schema alone does not.

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

* `users` — accounts, with a unique `username`, a `displayUsername` that
  keeps the typed capitalisation, an optional Markdown `bio` shown on the
  public profile, ban fields, `role`, and the account-deletion and
  username-cooldown columns
* `sessions` — auth sessions, indexed by user
* `accounts` — linked credential and social accounts
* `verifications` — verification tokens
* `passkeys` — WebAuthn credentials, indexed by user and credential id
* `username_history` — previous usernames, so a name stays reserved and
  still signs in for its previous owner

Application tables:

* `posts` — blog posts, published or draft
* `projects` — all six project types, with a `draft` / `pending` /
  `published` / `removed` lifecycle, review audit columns, download
  counters, tags, `is_protected`, and `pending_deletion`
* `project_versions` — released versions with a release channel, game
  versions, loaders, changelog, and a download counter; version number is
  unique per project
* `project_files` — uploaded archives, with size, SHA-1, SHA-512, storage
  key, and a partial unique index allowing at most one primary file per
  version
* `project_servers` — one row per server project, with address, optional
  port, and supported game versions
* `project_server_links` — the content a server links to, each marked
  required or recommended
* `admin_notifications` — the shared admin inbox
* `user_notifications` — per-user notifications, such as the result of a
  publishing review

There are no Postgres enums. Every enum-like column is `text` with a
TypeScript `$type<…>`, so adding a value is a code change rather than a
migration.

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
written by hand, and several do this alongside their DDL:

* `0006_project_files_unique.sql` — renames duplicate filenames and clears
  duplicate primary files before the unique indexes are created
* `0007_drop_account_issuer.sql` — drops the `accounts.issuer` column that
  Better Auth 1.7.3+ no longer writes
* `0009_account_lifecycle.sql` — backfills `users.has_owned_project` and
  `username_confirmed`
* `0010_postgres_search.sql` — creates the `pg_trgm` extension, pins
  `pg_trgm.similarity_threshold`, defines the immutable
  `array_to_string` wrapper, and creates the five search indexes
* `0011_document_postgres_search.sql` — contains no schema change at all;
  it exists to document why the index expressions must stay identical to
  `src/lib/search/text.ts`
* `0013_queue_published_projects_for_review.sql` — a pure data migration
  that moves every `published` project into the review queue. It is kept
  in its own file so the one step that changes what users can see can be
  reviewed — and held back — independently of the DDL it depends on. See
  [Projects and Files](../content/projects.md).

## Current migrations

| File | Adds |
| --- | --- |
| `0000_hot_franklin_richards.sql` | Baseline Better Auth tables |
| `0001_ordinary_hellcat.sql` | `users.username` |
| `0002_quick_kylun.sql` | `passkeys` |
| `0003_known_major_mapleleaf.sql` | Ban and role columns |
| `0004_add_posts.sql` | `posts` |
| `0005_add_projects.sql` | Projects, versions, files |
| `0006_project_files_unique.sql` | Per-version file uniqueness |
| `0007_drop_account_issuer.sql` | Removes `accounts.issuer` |
| `0008_add_composite_sort_indexes.sql` | Composite sort indexes |
| `0009_account_lifecycle.sql` | Deletion, history, protection |
| `0010_postgres_search.sql` | Search extension and indexes |
| `0011_document_postgres_search.sql` | Documentation only |
| `0012_add_project_moderation.sql` | Review columns, notifications |
| `0013_queue_published_projects_for_review.sql` | Queues published projects |
| `0014_add_user_bio.sql` | `users.bio` |
| `0015_add_project_servers.sql` | Servers and server links |
| `0016_add_project_images.sql` | `project_images`, one icon per project |

## Related

* [Setup](../development/setup.md)
* [Commands](../development/commands.md)
* [Search](../search/postgres.md)
* [Architecture Overview](../architecture/overview.md)
