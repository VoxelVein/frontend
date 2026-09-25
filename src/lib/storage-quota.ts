import { count, sql, sum } from "drizzle-orm";

import { db } from "@/db";
import { projectFiles } from "@/db/schema";
import { STORAGE_ERROR, StorageError } from "@/lib/storage";

// Arbitrary constant key for pg_advisory_xact_lock. Holding it serializes
// the final quota check and insert, so parallel uploads cannot each see
// room for themselves and overshoot the quota together.
const QUOTA_LOCK_KEY = 7_140_001;

type Executor = Pick<typeof db, "select">;

export interface StorageUsage {
  fileCount: number;
  quotaBytes: number | null;
  usedBytes: number;
}

/** Bytes used by every stored file, from the database (source of truth). */
export const getUsedBytes = async (executor: Executor = db) => {
  const [row] = await executor
    .select({ files: count(), used: sum(projectFiles.size) })
    .from(projectFiles);
  return { fileCount: row?.files ?? 0, usedBytes: Number(row?.used ?? 0) };
};

export const quotaExceededError = () =>
  new StorageError(
    STORAGE_ERROR.quotaExceeded,
    "The site's storage limit has been reached. Delete old versions or ask an admin to raise the limit."
  );

/** Bytes still free under the quota, or null when there is no quota. */
export const getRemainingBytes = async (
  quotaBytes: number | null
): Promise<number | null> => {
  if (quotaBytes === null) {
    return null;
  }
  const { usedBytes } = await getUsedBytes();
  return Math.max(0, quotaBytes - usedBytes);
};

/**
 * Records an uploaded file, re-checking the quota under a lock first.
 * Throws a quota-exceeded StorageError (and records nothing) when the file
 * would push total usage over the quota.
 */
export const insertFileWithinQuota = (
  values: typeof projectFiles.$inferInsert,
  quotaBytes: number | null
): Promise<void> =>
  db.transaction(async (tx) => {
    if (quotaBytes !== null) {
      await tx.execute(sql`select pg_advisory_xact_lock(${QUOTA_LOCK_KEY})`);
      const { usedBytes } = await getUsedBytes(tx);
      if (usedBytes + values.size > quotaBytes) {
        throw quotaExceededError();
      }
    }
    await tx.insert(projectFiles).values(values);
  });
