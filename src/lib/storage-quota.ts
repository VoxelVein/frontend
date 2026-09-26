import { count, eq, sql, sum } from "drizzle-orm";

import { db } from "@/db";
import { projectFiles } from "@/db/schema";
import { STORAGE_ERROR, StorageError } from "@/lib/storage";

// Arbitrary constant key for pg_advisory_xact_lock. Holding it serializes
// the final quota check and insert, so parallel uploads cannot each see
// room for themselves and overshoot the quota together.
const QUOTA_LOCK_KEY = 7_140_001;

// Namespace for the two-key pg_advisory_xact_lock taken per version, so
// uploads to one version run their duplicate and primary checks one at a
// time. The second key is a hash of the version id.
const VERSION_LOCK_NAMESPACE = 7_140_002;

const PG_UNIQUE_VIOLATION = "23505";

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

export class DuplicateFilenameError extends Error {
  constructor() {
    super("This version already has a file with that name.");
    this.name = "DuplicateFilenameError";
  }
}

const FILENAME_INDEX = "project_files_versionId_filename_uidx";

// Drizzle wraps driver errors, so the Postgres error may sit on a cause.
export const isDuplicateFilenameViolation = (cause: unknown): boolean => {
  if (!(cause instanceof Error)) {
    return false;
  }
  if (
    "code" in cause &&
    cause.code === PG_UNIQUE_VIOLATION &&
    "constraint" in cause &&
    cause.constraint === FILENAME_INDEX
  ) {
    return true;
  }
  return isDuplicateFilenameViolation(cause.cause);
};

type FileValues = Omit<typeof projectFiles.$inferInsert, "primary">;

/**
 * Records an uploaded file, re-checking the quota under a lock first.
 * The first file of a version becomes its primary file. Throws a
 * quota-exceeded StorageError when the file would push total usage over the
 * quota, and DuplicateFilenameError when the version already has a file with
 * that name; nothing is recorded in either case.
 */
export const insertFileWithinQuota = async (
  values: FileValues,
  quotaBytes: number | null
): Promise<{ primary: boolean }> => {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(${VERSION_LOCK_NAMESPACE}, hashtext(${values.versionId}))`
      );
      const existing = await tx
        .select({ filename: projectFiles.filename })
        .from(projectFiles)
        .where(eq(projectFiles.versionId, values.versionId));
      if (existing.some((file) => file.filename === values.filename)) {
        throw new DuplicateFilenameError();
      }

      if (quotaBytes !== null) {
        await tx.execute(sql`select pg_advisory_xact_lock(${QUOTA_LOCK_KEY})`);
        const { usedBytes } = await getUsedBytes(tx);
        if (usedBytes + values.size > quotaBytes) {
          throw quotaExceededError();
        }
      }

      const primary = existing.length === 0;
      await tx.insert(projectFiles).values({ ...values, primary });
      return { primary };
    });
  } catch (error) {
    // The unique index backs up the locked check above.
    throw isDuplicateFilenameViolation(error)
      ? new DuplicateFilenameError()
      : error;
  }
};
