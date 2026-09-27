import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { object, maxLength, pipe, string, trim, uuid } from "valibot";

import { db } from "@/db";
import {
  projects,
  projectVersions,
  userNotifications,
  users,
} from "@/db/schema";
import { DELETED_USER_LABEL } from "@/lib/projects";
import type { ProjectType } from "@/lib/projects";

/**
 * Why a review action could not be completed.
 *
 * Modelled as a code rather than a message so the UI can decide whether to
 * show the text, refresh, or both, without string matching.
 */
export const MODERATION_ERROR = {
  /** The project is not waiting for review, so there is nothing to decide. */
  notPending: "not-pending",
  /** The project has no uploaded file, so publishing it would serve nothing. */
  noFiles: "no-files",
  /** The rejection reason was empty or whitespace only. */
  reasonRequired: "reason-required",
} as const;

export type ModerationErrorCode =
  (typeof MODERATION_ERROR)[keyof typeof MODERATION_ERROR];

const MESSAGES: Record<ModerationErrorCode, string> = {
  [MODERATION_ERROR.notPending]:
    "This project is not waiting for review. Refresh to see its current state.",
  [MODERATION_ERROR.noFiles]:
    "This project has no uploaded file, so there is nothing to publish yet.",
  [MODERATION_ERROR.reasonRequired]: "Give a reason so the creator can fix it.",
};

export class ModerationError extends Error {
  readonly code: ModerationErrorCode;

  constructor(code: ModerationErrorCode) {
    super(MESSAGES[code]);
    this.name = "ModerationError";
    this.code = code;
  }
}

export const projectIdSchema = object({
  projectId: pipe(string(), uuid()),
});

export const rejectionSchema = object({
  projectId: pipe(string(), uuid()),
  reason: pipe(
    string(),
    trim(),
    // Matches the other free-text caps in the project forms, so a reason can
    // never be longer than the summary it is reacting to.
    maxLength(2000, "Keep the reason under 2000 characters.")
  ),
});

/** One row of the admin review queue. */
export interface PendingReview {
  category: string;
  description: string;
  id: string;
  name: string;
  /** Falls back to a placeholder when the owner's account was deleted. */
  ownerName: string;
  slug: string;
  /**
   * When review was requested. Falls back to the creation date for a project
   * that somehow reached `pending` without a submission timestamp, so the UI
   * never renders an empty cell.
   */
  submittedAt: string;
  summary: string;
  tags: string[];
  type: ProjectType;
  versionCount: number;
}

const REVIEW_LIMIT = 200;

/**
 * Whether the project has at least one version to publish.
 *
 * Lives here rather than in `projects.functions.ts` because moderation is now
 * the primary caller: a project with no version is not worth an admin's time,
 * so the creator is stopped before it ever reaches the queue.
 */
export const hasVersion = async (projectId: string): Promise<boolean> => {
  const [row] = await db
    .select({ versions: count(projectVersions.id) })
    .from(projectVersions)
    .where(eq(projectVersions.projectId, projectId));
  return (row?.versions ?? 0) > 0;
};

/** The review queue, oldest request first so nothing waits forever. */
export const listPendingReviews = async (): Promise<PendingReview[]> => {
  const rows = await db
    .select({
      category: projects.category,
      createdAt: projects.createdAt,
      description: projects.description,
      id: projects.id,
      name: projects.name,
      ownerName: sql<string | null>`coalesce(
        ${users.displayUsername},
        ${users.username},
        ${users.name}
      )`,
      slug: projects.slug,
      submittedAt: projects.submittedAt,
      summary: projects.summary,
      tags: projects.tags,
      type: projects.type,
    })
    .from(projects)
    .leftJoin(users, eq(users.id, projects.ownerId))
    .where(eq(projects.status, "pending"))
    // submitted_at is the queue's ordering key and is indexed alongside
    // status. created_at only breaks ties between rows submitted in the same
    // transaction, so it never changes the primary order.
    .orderBy(asc(projects.submittedAt), asc(projects.createdAt))
    .limit(REVIEW_LIMIT);

  if (rows.length === 0) {
    return [];
  }

  // One grouped query beats a per-row subselect and keeps the queue to a fixed
  // number of round trips regardless of how many projects are waiting.
  const versionCounts = await db
    .select({
      projectId: projectVersions.projectId,
      versions: count(projectVersions.id),
    })
    .from(projectVersions)
    .where(
      inArray(
        projectVersions.projectId,
        rows.map((row) => row.id)
      )
    )
    .groupBy(projectVersions.projectId);

  const versionsByProject = new Map(
    versionCounts.map((row) => [row.projectId, row.versions])
  );

  return rows.map((row) => ({
    category: row.category,
    description: row.description,
    id: row.id,
    name: row.name,
    ownerName: row.ownerName ?? DELETED_USER_LABEL,
    slug: row.slug,
    submittedAt: (row.submittedAt ?? row.createdAt).toISOString(),
    summary: row.summary,
    tags: row.tags,
    type: row.type,
    versionCount: versionsByProject.get(row.id) ?? 0,
  }));
};

/**
 * Moves a draft into the review queue.
 *
 * Clears any previous rejection reason: it described the last decision, and
 * leaving it would show a stale explanation next to a fresh submission.
 */
export const submitForReview = async (projectId: string): Promise<void> => {
  if (!(await hasVersion(projectId))) {
    throw new ModerationError(MODERATION_ERROR.noFiles);
  }

  const [updated] = await db
    .update(projects)
    .set({
      rejectionReason: null,
      status: "pending",
      submittedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.status, "draft")))
    .returning({ id: projects.id });

  if (!updated) {
    throw new ModerationError(MODERATION_ERROR.notPending);
  }
};

/**
 * Cancels a pending review request and returns the project to draft.
 *
 * Separate from `submitForReview` because it is the only transition that runs
 * from `pending`. Guarded on that status so it cannot be used to reach around
 * the review step from any other state.
 */
export const withdrawReview = async (projectId: string): Promise<void> => {
  const [updated] = await db
    .update(projects)
    .set({ status: "draft", submittedAt: null })
    .where(and(eq(projects.id, projectId), eq(projects.status, "pending")))
    .returning({ id: projects.id });

  if (!updated) {
    throw new ModerationError(MODERATION_ERROR.notPending);
  }
};

/**
 * Approves a project and makes it public.
 *
 * The status guard sits in the `where` clause rather than in a prior read, so
 * two admins clicking approve at the same moment cannot both succeed: only the
 * update that actually changed a row reports back, and only that one notifies
 * the creator. The state change and the notification share a transaction, so a
 * failed insert cannot leave an approved project with no notification.
 */
export const approveReview = async (
  projectId: string,
  adminId: string
): Promise<void> => {
  const now = new Date();

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(projects)
      .set({
        // A project that was live before and is being republished keeps its
        // original publication date; a first publication is stamped now.
        publishedAt: sql`coalesce(${projects.publishedAt}, ${now})`,
        rejectionReason: null,
        reviewedAt: now,
        reviewedBy: adminId,
        status: "published",
        submittedAt: null,
      })
      .where(and(eq(projects.id, projectId), eq(projects.status, "pending")))
      .returning({ name: projects.name, ownerId: projects.ownerId });

    if (!updated) {
      throw new ModerationError(MODERATION_ERROR.notPending);
    }

    // A project whose owner deleted their account has nobody to tell.
    if (updated.ownerId) {
      await tx.insert(userNotifications).values({
        message: `An admin approved "${updated.name}". It is now listed on the site and can be downloaded by anyone.`,
        projectId,
        title: "Project approved",
        type: "project-approved",
        userId: updated.ownerId,
      });
    }
  });
};

/**
 * Sends a project back to draft with a reason.
 *
 * There is no rejected status on purpose. Returning to draft means the creator
 * can fix the problem and resubmit, rather than being parked in a terminal
 * state that nothing moves them out of.
 */
export const rejectReview = async (
  projectId: string,
  adminId: string,
  reason: string
): Promise<void> => {
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    throw new ModerationError(MODERATION_ERROR.reasonRequired);
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(projects)
      .set({
        rejectionReason: trimmed,
        reviewedAt: now,
        reviewedBy: adminId,
        status: "draft",
        submittedAt: null,
      })
      .where(and(eq(projects.id, projectId), eq(projects.status, "pending")))
      .returning({ name: projects.name, ownerId: projects.ownerId });

    if (!updated) {
      throw new ModerationError(MODERATION_ERROR.notPending);
    }

    if (updated.ownerId) {
      await tx.insert(userNotifications).values({
        message: `An admin sent "${updated.name}" back to draft: ${trimmed}`,
        projectId,
        title: "Project needs changes",
        type: "project-rejected",
        userId: updated.ownerId,
      });
    }
  });
};
