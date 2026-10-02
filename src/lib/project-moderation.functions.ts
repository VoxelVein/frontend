import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, count, eq } from "drizzle-orm";
import { parse } from "valibot";

import { db } from "@/db";
import { projects } from "@/db/schema";
import { requireEditableProject, requireUploader } from "@/lib/project-access";
import type { Session } from "@/lib/project-access";
import {
  approveReview,
  listPendingReviews as listPendingReviewsInDb,
  projectIdSchema,
  rejectReview,
  rejectionSchema,
  submitForReview,
  withdrawReview,
} from "@/lib/project-moderation";
import type { PendingReview } from "@/lib/project-moderation";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  consumeServerLimit,
  RATE_LIMIT_MESSAGE,
} from "@/lib/rate-limit-server";
import { requireCapability } from "@/lib/role-guards";

/**
 * Resolves the caller's staff session.
 *
 * Throws rather than returning null so no handler can forget to check, which
 * is the failure mode that would let a non-staff account reach a decision
 * endpoint. Reviewing is the moderator's core duty, so the bar is moderator.
 */
const requireReviewer = (): Promise<Session> =>
  requireCapability("reviewProjects");

/**
 * Caps the moderation decisions one account can make.
 *
 * Reviewing is the highest-value staff action here — approving publishes a
 * project — so it gets its own bucket rather than sharing the post-write one.
 */
const requireReviewQuota = async (session: Session): Promise<void> => {
  const quota = await consumeServerLimit(
    "project-review",
    `user:${session.user.id}`,
    RATE_LIMITS.write
  );
  if (quota) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }
};

const getOwner = (): Promise<Session> => requireUploader(getRequestHeaders());

/** Every project currently waiting for a decision, oldest first. */
export const listPendingReviews = createServerFn({ method: "GET" }).handler(
  async (): Promise<PendingReview[]> => {
    await requireReviewer();
    return listPendingReviewsInDb();
  }
);

/** How many projects are waiting, for the tab badge. */
export const countPendingReviews = createServerFn({ method: "GET" }).handler(
  async (): Promise<number> => {
    await requireReviewer();
    const [row] = await db
      .select({ pending: count() })
      .from(projects)
      .where(eq(projects.status, "pending"));
    return row?.pending ?? 0;
  }
);

/** Approves a project, making it publicly visible. */
export const approveProject = createServerFn({ method: "POST" })
  .validator((data: { projectId: string }) => parse(projectIdSchema, data))
  .handler(async ({ data }): Promise<void> => {
    const session = await requireReviewer();
    await requireReviewQuota(session);
    await approveReview(data.projectId, session.user.id);
  });

/** Sends a project back to draft with a reason the creator can act on. */
export const rejectProject = createServerFn({ method: "POST" })
  .validator((data: { projectId: string; reason: string }) =>
    parse(rejectionSchema, data)
  )
  .handler(async ({ data }): Promise<void> => {
    const session = await requireReviewer();
    await requireReviewQuota(session);
    await rejectReview(data.projectId, session.user.id, data.reason);
  });

/**
 * Asks an admin to publish a draft.
 *
 * The project does not become public here. It moves to `pending` and waits,
 * which is the whole point of the review step.
 */
export const submitProjectForReview = createServerFn({ method: "POST" })
  .validator((data: { projectId: string }) => parse(projectIdSchema, data))
  .handler(async ({ data }): Promise<void> => {
    const session = await getOwner();
    await requireReviewQuota(session);
    await requireEditableProject(session, data.projectId);
    await submitForReview(data.projectId);
  });

/**
 * Cancels a pending request without waiting for an admin.
 *
 * A creator who submitted by mistake should not be stuck in the queue, and an
 * admin should not have to reject a project its owner no longer wants.
 */
export const withdrawProjectReview = createServerFn({ method: "POST" })
  .validator((data: { projectId: string }) => parse(projectIdSchema, data))
  .handler(async ({ data }): Promise<void> => {
    const session = await getOwner();
    await requireReviewQuota(session);
    await requireEditableProject(session, data.projectId);
    await withdrawReview(data.projectId);
  });

/**
 * Takes a live project back to draft.
 *
 * Deliberately not gated on review: removing something from public view is the
 * opposite of publishing it, and making an admin approve a takedown would
 * leave a project visible that its owner has already withdrawn.
 */
export const unpublishProject = createServerFn({ method: "POST" })
  .validator((data: { projectId: string }) => parse(projectIdSchema, data))
  .handler(async ({ data }): Promise<void> => {
    const session = await getOwner();
    await requireReviewQuota(session);
    await requireEditableProject(session, data.projectId);
    await db
      .update(projects)
      .set({ status: "draft" })
      .where(
        and(eq(projects.id, data.projectId), eq(projects.status, "published"))
      );
  });
