import { and, count, eq, inArray, sql, sum } from "drizzle-orm";

import { db } from "@/db";
import { projectFiles, projectImages, userImages } from "@/db/schema";
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

// Namespace for the two-key pg_advisory_xact_lock taken per project image
// upload, so a project's icon cannot be replaced twice concurrently. The
// second key is a hash of the project id.
const IMAGE_LOCK_NAMESPACE = 7_140_003;

// Namespace for the same lock taken per avatar upload, so two concurrent
// avatar uploads for one account cannot both read the superseded key and leave
// an orphan object behind. Distinct from IMAGE_LOCK_NAMESPACE because the
// second key is a user id, not a project id, and the two namespaces must not
// interleave.
const AVATAR_LOCK_NAMESPACE = 7_140_004;

type Executor = Pick<typeof db, "select">;

export interface StorageUsage {
  /** Bytes held by user avatars. */
  avatarBytes: number;
  avatarCount: number;
  /** Bytes held by downloadable project files. */
  fileBytes: number;
  fileCount: number;
  /** Bytes held by project icons and gallery images. */
  imageBytes: number;
  imageCount: number;
  quotaBytes: number | null;
  usedBytes: number;
}

type ImageValues = typeof projectImages.$inferInsert;

/**
 * Bytes used by every stored object, from the database (source of truth).
 *
 * Images count toward the same quota as downloadable files, so the limit
 * reflects what the bucket actually holds and the admin storage panel stays
 * truthful. The per-kind byte totals are returned because the two grow very
 * differently: images are stored unresized, so a handful of photos can
 * dominate the bucket, and an admin cannot act on one combined number.
 */
export const getUsedBytes = async (executor: Executor = db) => {
  // Avatars are counted here rather than tracked separately: they consume the
  // same site-wide quota, so leaving them out would let a few thousand accounts
  // fill the bucket past the configured ceiling without ever tripping it.
  const [[file], [image], [avatar]] = await Promise.all([
    executor
      .select({ files: count(), used: sum(projectFiles.size) })
      .from(projectFiles),
    executor
      .select({ images: count(), used: sum(projectImages.size) })
      .from(projectImages),
    executor
      .select({ avatars: count(), used: sum(userImages.size) })
      .from(userImages),
  ]);
  const fileBytes = Number(file?.used ?? 0);
  const imageBytes = Number(image?.used ?? 0);
  const avatarBytes = Number(avatar?.used ?? 0);
  return {
    avatarBytes,
    avatarCount: avatar?.avatars ?? 0,
    fileBytes,
    fileCount: file?.files ?? 0,
    imageBytes,
    imageCount: image?.images ?? 0,
    usedBytes: fileBytes + imageBytes + avatarBytes,
  };
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
 * Records an uploaded image, re-checking the quota under a lock first.
 *
 * A project has at most one icon: the previous row is deleted in the same
 * transaction so a replaced icon does not leave an orphan row behind. The
 * caller deletes the superseded object once this resolves.
 *
 * Gallery images are appended; the per-project count is capped by the route.
 */
export const insertImageWithinQuota = async (
  values: ImageValues,
  quotaBytes: number | null
): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${IMAGE_LOCK_NAMESPACE}, hashtext(${values.projectId}))`
    );
    if (values.kind === "icon") {
      await tx
        .delete(projectImages)
        .where(
          and(
            eq(projectImages.projectId, values.projectId),
            eq(projectImages.kind, "icon")
          )
        );
    }
    if (quotaBytes !== null) {
      await tx.execute(sql`select pg_advisory_xact_lock(${QUOTA_LOCK_KEY})`);
      const { usedBytes } = await getUsedBytes(tx);
      if (usedBytes + values.size > quotaBytes) {
        throw quotaExceededError();
      }
    }
    await tx.insert(projectImages).values(values);
  });
};

type AvatarValues = typeof userImages.$inferInsert;

/**
 * Records an avatar for an account, replacing any previous one.
 *
 * Deliberately a sibling of `insertImageWithinQuota` rather than a
 * generalisation of it: that one deletes the superseded row and inserts into
 * `project_images`, so sharing it would have meant writing a user id into the
 * project table. What is shared is the discipline, and it is the part that
 * matters — the quota is checked inside the same transaction as the insert, and
 * both take the same `QUOTA_LOCK_KEY`, so a project upload and an avatar upload
 * cannot each see room for themselves and overshoot together.
 *
 * Returns the superseded storage key so the caller can delete the object it
 * replaced, or null when there was none. The key is read *before* the delete,
 * which is why the per-user advisory lock is taken first.
 */
export const insertAvatarWithinQuota = async (
  values: AvatarValues,
  quotaBytes: number | null
): Promise<string | null> => {
  let superseded: string | null = null;

  await db.transaction(async (tx) => {
    // Serialises concurrent uploads for one account, so two of them cannot both
    // read the same previous key and leave one object orphaned.
    await tx.execute(
      sql`select pg_advisory_xact_lock(${AVATAR_LOCK_NAMESPACE}, hashtext(${values.userId}))`
    );

    const [previous] = await tx
      .select({ storageKey: userImages.storageKey })
      .from(userImages)
      .where(eq(userImages.userId, values.userId))
      .limit(1);
    superseded = previous?.storageKey ?? null;

    if (quotaBytes !== null) {
      await tx.execute(sql`select pg_advisory_xact_lock(${QUOTA_LOCK_KEY})`);
      const { usedBytes } = await getUsedBytes(tx);
      // The superseded row is still counted, since it has not been deleted yet.
      // Subtracting it is what lets a user replace a large avatar without
      // needing room for both at once.
      const replaced = superseded
        ? await tx
            .select({ size: userImages.size })
            .from(userImages)
            .where(eq(userImages.storageKey, superseded))
            .limit(1)
        : [];
      const freed = Number(replaced[0]?.size ?? 0);
      if (usedBytes - freed + values.size > quotaBytes) {
        throw quotaExceededError();
      }
    }

    await tx
      .insert(userImages)
      .values(values)
      .onConflictDoUpdate({
        set: {
          contentType: values.contentType,
          height: values.height,
          size: values.size,
          storageKey: values.storageKey,
          width: values.width,
        },
        target: userImages.userId,
      });
  });

  return superseded;
};

/** Removes an account's avatar row and returns the key so it can be deleted. */
export const removeAvatar = async (userId: string): Promise<string | null> => {
  const [row] = await db
    .delete(userImages)
    .where(eq(userImages.userId, userId))
    .returning({ storageKey: userImages.storageKey });
  return row?.storageKey ?? null;
};

/** Storage keys of a project's images, for cleanup before deleting it. */
export const getProjectImageKeys = async (projectIds: string[]) => {
  if (projectIds.length === 0) {
    return [];
  }
  return await db
    .select({ storageKey: projectImages.storageKey })
    .from(projectImages)
    .where(inArray(projectImages.projectId, projectIds));
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
