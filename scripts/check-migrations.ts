import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

/**
 * Fails when `src/db/schema.ts` has changed without a matching migration.
 *
 * Deploys apply migrations automatically at merge time, so a schema edit
 * without a generated migration ships code that reads columns the database
 * does not have. This catches that in CI instead, and needs no database:
 * `drizzle-kit generate` only reads the schema.
 */

// The project-local binary. `pnpm dlx drizzle-kit` runs in a fresh environment
// without drizzle-orm and fails with "Please install latest version of
// drizzle-orm".
const DRIZZLE_KIT = path.resolve("node_modules/.bin/drizzle-kit");

const MIGRATIONS_DIR = "drizzle";

const snapshotCount = (): number => {
  const snapshots = readdirSync(path.join(MIGRATIONS_DIR, "meta")).filter(
    (file) => file.endsWith("_snapshot.json")
  );
  return snapshots.length;
};

const before = snapshotCount();

// Any SQL file written by this run is a new migration, so it is also caught.
const beforeMigrations = new Set(readdirSync(MIGRATIONS_DIR));

try {
  // Output is discarded rather than printed: `generate` is chatty when it
  // finds no work, and its chatter is not a check result.
  execFileSync(DRIZZLE_KIT, ["generate"], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  // Generate failing outright is also a failure, but it means the schema or
  // config is broken rather than that a migration is missing.
  const detail = error instanceof Error ? error.message : "unknown error";
  process.stderr.write(
    `drizzle-kit generate failed, so the schema could not be checked:\n${detail}\n`
  );
  process.exit(1);
}

const afterMigrations = readdirSync(MIGRATIONS_DIR);
const wroteSql = afterMigrations.some(
  (file) => file.endsWith(".sql") && !beforeMigrations.has(file)
);

if (wroteSql || snapshotCount() > before) {
  process.stderr.write(
    [
      "",
      "The Drizzle schema and the migrations disagree: running",
      "`drizzle-kit generate` produced a new migration, so",
      "src/db/schema.ts has changes that were never committed.",
      "",
      "Generate it locally and commit both files:",
      "",
      "  ./node_modules/.bin/drizzle-kit generate",
      "  # then rename the file to 00NN_snake_case_intent.sql",
      "",
      `Generated migration: ${afterMigrations.find(
        (file) => file.endsWith(".sql") && !beforeMigrations.has(file)
      )}`,
      "",
    ].join("\n")
  );
  process.exit(1);
}

process.stdout.write("No schema changes, migrations are in sync.\n");
