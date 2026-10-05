import { is } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import type { IndexedColumn } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

// oxlint-disable-next-line sonarjs/no-wildcard-import -- The wildcard is the mechanism: the test reads every table the module exports, so a table added later is covered without this file being edited. Naming them here would reintroduce the list this is meant to replace.
import * as schema from "@/db/schema";

/**
 * Postgres never indexes a foreign key for you.
 *
 * Adding a `.references()` clause costs nothing at write time, and then makes
 * every delete of the parent row a sequential scan of the child table, because
 * the constraint check has nothing to probe. Seven columns had exactly that
 * problem until `0022_index_foreign_keys.sql`; this is what keeps an eighth
 * from arriving silently.
 *
 * The tables are discovered from the module's own exports rather than listed
 * here, so a newly added table is covered the moment it exists and there is no
 * list to fall out of date.
 */

/**
 * Every table the schema module exports, paired with its export name.
 *
 * `PgTable` rather than `Table`, so the `relations(...)` exports this module
 * also has are excluded by the type and not only at runtime.
 */
const tables: readonly (readonly [string, PgTable])[] = Object.entries(
  schema
).flatMap(([name, value]) =>
  is(value, PgTable) ? [[name, value] as const] : []
);

/**
 * The column an index or foreign key refers to.
 *
 * Both accept an expression as readily as a column — a GIN index over
 * `to_tsvector(...)` names no single column — so the name is optional and the
 * expression cases simply do not count towards covering anything.
 */
const columnName = (
  column: Partial<IndexedColumn> | Partial<SQL>
): string | undefined => ("name" in column ? column.name : undefined);

/**
 * A foreign key as `table.column`, one entry per constrained column.
 *
 * A composite foreign key produces an entry per column, which is what the rule
 * below actually cares about: each column is probed on its own.
 */
const foreignKeys = tables.flatMap(([table, definition]) =>
  getTableConfig(definition).foreignKeys.flatMap((key) =>
    key.reference().columns.map((column) => `${table}.${columnName(column)}`)
  )
);

/**
 * The column each index leads on, as `table.column`.
 *
 * Primary keys count, and there are two ways to declare one. A table-level
 * `primaryKey({ columns: [...] })` appears in `config.primaryKeys`; a
 * column-level `.primaryKey()` — `project_servers.project_id` — does not, and
 * is read off the column's own `primary` flag instead. Either way the column is
 * backed by a unique index, so it serves a lookup as well as any declared index
 * does.
 */
const leadingIndexColumns = tables.flatMap(([table, definition]) => {
  const config = getTableConfig(definition);

  return [
    ...config.indexes.map(
      (index) => `${table}.${columnName(index.config.columns[0])}`
    ),
    ...config.primaryKeys.map(
      (key) => `${table}.${columnName(key.columns[0])}`
    ),
    ...config.columns
      .filter((column) => column.primary)
      .map((column) => `${table}.${column.name}`),
  ];
});

describe("foreign key indexes", () => {
  it("finds the tables and keys to check, so the next test cannot pass on nothing", () => {
    // A floor rather than an exact count, so adding a table does not fail here.
    // What this guards is the discovery silently returning an empty list, which
    // would make the assertion below true for the wrong reason.
    expect(tables.length).toBeGreaterThanOrEqual(18);
    expect(foreignKeys.length).toBeGreaterThan(0);
  });

  it("leads an index on every foreign key column", () => {
    const indexed = new Set(leadingIndexColumns);
    const unindexed = foreignKeys.filter((key) => !indexed.has(key));

    // Leading column, because a composite index only serves lookups from the
    // left: `(user_id, read_at)` covers `user_id`, `(read_at, user_id)` does
    // not. Testing only "is this column indexed somewhere" would let an index
    // that can never answer the constraint check pass.
    expect(unindexed).toStrictEqual([]);
  });

  it("leads nothing on a column that does not exist", () => {
    // The other direction. An index left behind by a dropped column is not
    // free: it is written on every insert and read by nothing. Rare enough
    // that neither the schema nor the migration will flag it.
    const known = new Set(
      tables.flatMap(([table, definition]) =>
        getTableConfig(definition).columns.map(
          (column) => `${table}.${column.name}`
        )
      )
    );
    const orphaned = leadingIndexColumns.filter((key) => !known.has(key));

    expect(orphaned).toStrictEqual([]);
  });
});
