---
name: drizzle-migrations
description: Change the Postgres schema safely in this repo — generating a Drizzle migration, naming the file, reviewing the SQL, applying it, and handling the deploy and search-index consequences. Use when adding or altering a table, column, index, or constraint in src/db/schema.ts, when touching Better Auth's schema, or when a migration fails to apply. Triggers on "add a column", "change the schema", "migrate", "alter table", "add an index", or any edit to src/db/schema.ts.
version: 1.0.0
author: voxelvein
type: skill
category: database
tags:
  - drizzle
  - postgres
  - migrations
  - schema
---

# Drizzle Migrations

## The one thing that bites everyone

**Use the project-local binary. Never `pnpm dlx`.**

```bash
./node_modules/.bin/drizzle-kit generate   # correct
pnpm dlx drizzle-kit generate              # WRONG
```

`pnpm dlx` runs in a fresh environment without the project's
`drizzle-orm` and fails with *"Please install latest version of
drizzle-orm"*. The same applies to `migrate` and `studio`.

## Environment

`drizzle.config.ts` imports `env.config.ts`, which **validates on load**.
Running any `drizzle-kit` command therefore requires:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`

Missing any of them fails before Drizzle starts — including `generate`,
which does not touch the database but still loads the config. Copy
`.env.example` if the environment isn't set up.

## Workflow

### 1. Edit the schema

All tables live in `src/db/schema.ts` — there are no per-table files.
It exports `users`, `sessions`, `accounts`, `verifications`, `passkeys`,
`posts`, `projects`, `projectVersions`, `projectFiles`, plus a
`relations` block per table.

The first five are **Better Auth's** tables. Changing them breaks
existing sessions and passkeys; check the Better Auth docs (see the
`context7` skill) before touching them.

### 2. Generate

```bash
./node_modules/.bin/drizzle-kit generate
```

This writes a numbered `.sql` file and a snapshot into `drizzle/`.

### 3. Rename the file

Drizzle generates names like `0003_quick_kylun.sql`. This repo's
convention from `0004` onward is **descriptive**:

```
0004_add_posts.sql
0005_add_projects.sql
0006_project_files_unique.sql
0007_drop_account_issuer.sql
```

Rename to `00NN_snake_case_intent.sql`. **You must also set that
entry's `tag` in `drizzle/meta/_journal.json` to the new name.** The
migrator resolves the SQL file by `tag`, so a renamed `.sql` with an
unchanged tag makes `drizzle-kit migrate` exit 1 with no error message
at all — the spinner overwrites the real error, so it reads like a
silent skip and the migration never applies. Leave the snapshot file
alone: `00NN_snapshot.json` is named by index, not by tag.

### 4. Read the generated SQL — always

Never apply an unreviewed migration. Drizzle will happily emit a
destructive statement you did not intend. Check specifically for:

- **Drops.** Does it drop a column, table, or index you didn't mean to?
- **Cascade.** A dropped FK with `CASCADE` deletes dependent rows.
- **Missing indexes** on new foreign keys. Postgres never creates these,
  so the schema has to. `src/db/__tests__/foreign-key-indexes.test.ts`
  fails on any FK column that leads no index, so `pnpm test` catches it —
  but that only helps if the index is missing from the schema, not just
  from the generated SQL.
- **Type changes** that rewrite the whole table (`ALTER COLUMN TYPE`
  without a `USING` clause usually fails; a widening `varchar` is
  usually safe).
- **Defaults on NOT NULL columns** added to a table that already has
  rows — this fails if the table is non-empty.

If the output doesn't match your intent, fix the schema and regenerate.
Don't hand-edit the SQL unless you know exactly why.

### 5. Apply locally

```bash
pnpm db:migrate
pnpm db:studio   # inspect the result
```

### 6. Update the search index if a searchable field changed

Search reads `posts` and `projects` directly, so there is no derived index to
resync and no reindex command. A changed field does need a matching index:

- Changing a `tsvector` expression means editing it in **both** the migration
  and `src/lib/search/text.ts`, identically. A GIN expression index is only
  used when the query repeats the expression exactly, and a mismatch does not
  error — it silently falls back to a sequential scan.
- A new indexed expression needs its own `CREATE INDEX` in a generated
  migration.
- Verify with `EXPLAIN` that the index is used, not by reading the code.

## Deploy behaviour

Merging to `main` deploys. `compose.yaml` defines a one-shot `migrate`
service that runs `drizzle-kit migrate` and exits; the `api` and `web`
services start only after it succeeds. `main` is promoted to `prod`.

This means **migrations are applied automatically, without review, at
merge time.** Therefore:

- Migrations must be **backward compatible** with the currently-running
  code. The old code is live until the new image finishes starting.
- Split destructive changes into two PRs: first deploy code that stops
  using the column, then drop it.
- Adding a NOT NULL column without a default breaks the old code path
  that still inserts into the table. Add it nullable, backfill, then
  tighten.
- Renaming a column is two migrations, never one.

## Pre-submit checklist

- [ ] Generated with the project-local binary
- [ ] File renamed to `00NN_snake_case_intent.sql`
- [ ] Generated SQL read; no unintended drops or cascades
- [ ] Backward compatible with the running version
- [ ] `pnpm db:migrate` succeeds locally
- [ ] Reindex run if `posts`/`projects` changed
- [ ] `drizzle/` SQL **and** `meta/` snapshot both committed
