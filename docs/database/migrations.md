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

## Review the SQL

Always review the generated SQL before applying it. Check that:

* New tables have the expected columns and constraints.
* Indexes are created for foreign keys.
* The migration matches the intent of the schema change.

## Schema

The schema lives in `src/db/schema.ts` and currently defines:

* `users` — user accounts
* `sessions` — auth sessions
* `accounts` — linked social/oauth accounts
* `verifications` — verification tokens
* `passkeys` — WebAuthn passkey credentials

## Related

* [Setup](../development/setup.md)
* [Architecture Overview](../architecture/overview.md)
