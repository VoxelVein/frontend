import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, avg, count, desc, eq } from "drizzle-orm";
import {
  maxLength,
  object,
  optional,
  parse,
  picklist,
  pipe,
  string,
  trim,
  uuid,
} from "valibot";

import { db } from "@/db";
import { projectDownloads, projectReviews, projects, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_MESSAGES,
  REVIEW_RATINGS,
  refusalMessage,
  reviewEligibility,
} from "@/lib/project-reviews";
import type { ReviewEligibility, ReviewRating } from "@/lib/project-reviews";
import { DELETED_USER_LABEL } from "@/lib/projects";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  consumeServerLimit,
  rateLimitIdentity,
  RATE_LIMIT_MESSAGE,
} from "@/lib/rate-limit-server";

/**
 * Player reviews of projects and servers.
 *
 * Every rule lives here rather than in the component: the submit button can be
 * hidden in the UI and the request would still be one curl call away. The
 * download delay, the one-review-per-account rule and the published-project
 * check are all re-evaluated at write time.
 */

interface ProjectInput {
  projectId: string;
}

interface ReviewInput {
  comment?: string;
  projectId: string;
  rating: ReviewRating;
}

const projectSchema = object({ projectId: pipe(string(), uuid()) });

const reviewSchema = object({
  ...projectSchema.entries,
  comment: optional(
    pipe(string(), trim(), maxLength(REVIEW_COMMENT_MAX_LENGTH))
  ),
  rating: picklist(REVIEW_RATINGS),
});

const trustProxy = (): boolean => process.env.TRUST_PROXY === "true";

/** Only published listings can be read or reviewed by visitors. */
const requirePublishedProject = async (projectId: string) => {
  const [project] = await db
    .select({ id: projects.id, type: projects.type })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.status, "published"),
        eq(projects.pendingDeletion, false)
      )
    )
    .limit(1);

  if (!project) {
    throw new Error(REVIEW_MESSAGES.unavailable);
  }

  return project;
};

export interface ReviewView {
  authorName: string;
  comment: string | null;
  createdAt: string;
  id: string;
  rating: number;
}

export interface ReviewListing {
  /** Mean of the stored ratings, to one decimal, or null when there are none. */
  averageRating: number | null;
  ratingCount: number;
  reviews: ReviewView[];
}

/** The newest reviews first, with a mean rating for the page heading. */
export const listProjectReviews = createServerFn({ method: "GET" })
  .validator((data: ProjectInput) => parse(projectSchema, data))
  .handler(async ({ data }): Promise<ReviewListing> => {
    const project = await requirePublishedProject(data.projectId);
    const headers = getRequestHeaders();

    if (
      await consumeServerLimit(
        "reviews-read",
        rateLimitIdentity(headers, trustProxy()),
        RATE_LIMITS.read
      )
    ) {
      throw new Error(RATE_LIMIT_MESSAGE);
    }

    const [summaries, rows] = await Promise.all([
      db
        .select({ average: avg(projectReviews.rating), total: count() })
        .from(projectReviews)
        .where(eq(projectReviews.projectId, project.id)),
      db
        .select({
          authorName: users.name,
          comment: projectReviews.comment,
          createdAt: projectReviews.createdAt,
          id: projectReviews.id,
          rating: projectReviews.rating,
        })
        .from(projectReviews)
        .leftJoin(users, eq(users.id, projectReviews.userId))
        .where(eq(projectReviews.projectId, project.id))
        .orderBy(desc(projectReviews.createdAt))
        .limit(20),
    ]);

    const [summary] = summaries;

    return {
      averageRating:
        summary?.average === null || summary === undefined
          ? null
          : Math.round(Number(summary.average) * 10) / 10,
      ratingCount: Number(summary?.total ?? 0),
      reviews: rows.map((row) => ({
        authorName: row.authorName ?? DELETED_USER_LABEL,
        comment: row.comment,
        createdAt: row.createdAt.toISOString(),
        id: row.id,
        rating: row.rating,
      })),
    };
  });

export interface ReviewStatus extends ReviewEligibility {
  hasReviewed: boolean;
}

/**
 * What the current account may do on this page.
 *
 * Signed-out visitors get a sign-in reason without any per-user queries; the
 * answer is keyed on the account in the query cache so switching accounts
 * cannot reuse the previous one's eligibility.
 */
export const reviewStatus = createServerFn({ method: "GET" })
  .validator((data: ProjectInput) => parse(projectSchema, data))
  .handler(async ({ data }): Promise<ReviewStatus> => {
    const project = await requirePublishedProject(data.projectId);
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });

    if (!session) {
      return {
        downloadReadyAt: null,
        eligible: false,
        hasReviewed: false,
        reason: "sign-in",
      };
    }

    const [existing] = await db
      .select({ id: projectReviews.id })
      .from(projectReviews)
      .where(
        and(
          eq(projectReviews.projectId, project.id),
          eq(projectReviews.userId, session.user.id)
        )
      )
      .limit(1);

    // Servers have no files, so a download row for one would be meaningless.
    let downloadedAt: Date | null = null;

    if (project.type !== "server") {
      const downloads = await db
        .select({ downloadedAt: projectDownloads.downloadedAt })
        .from(projectDownloads)
        .where(
          and(
            eq(projectDownloads.projectId, project.id),
            eq(projectDownloads.userId, session.user.id)
          )
        )
        .limit(1);

      downloadedAt = downloads[0]?.downloadedAt ?? null;
    }

    return {
      ...reviewEligibility({
        downloadedAt,
        emailVerified: !!session.user.emailVerified,
        hasReviewed: existing !== undefined,
        kind: project.type === "server" ? "server" : "project",
        signedIn: true,
      }),
      hasReviewed: existing !== undefined,
    };
  });

/** Records one rating and optional note, re-checking eligibility on the server. */
export const createProjectReview = createServerFn({ method: "POST" })
  .validator((data: ReviewInput) => parse(reviewSchema, data))
  .handler(async ({ data }): Promise<ReviewView> => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });

    if (!session) {
      throw new Error(REVIEW_MESSAGES["sign-in"]);
    }

    if (session.user.banned) {
      throw new Error("Your account cannot leave reviews.");
    }

    if (
      await consumeServerLimit(
        "reviews-write",
        rateLimitIdentity(headers, trustProxy(), session.user.id),
        RATE_LIMITS.write
      )
    ) {
      throw new Error(RATE_LIMIT_MESSAGE);
    }

    const project = await requirePublishedProject(data.projectId);

    return db.transaction(async (tx) => {
      // A row lock serializes the duplicate check and the five-second gate.
      await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, project.id))
        .for("update");

      const [existing] = await tx
        .select({ id: projectReviews.id })
        .from(projectReviews)
        .where(
          and(
            eq(projectReviews.projectId, project.id),
            eq(projectReviews.userId, session.user.id)
          )
        )
        .limit(1);

      let downloadedAt: Date | null = null;

      if (project.type !== "server") {
        const downloads = await tx
          .select({ downloadedAt: projectDownloads.downloadedAt })
          .from(projectDownloads)
          .where(
            and(
              eq(projectDownloads.projectId, project.id),
              eq(projectDownloads.userId, session.user.id)
            )
          )
          .limit(1);

        downloadedAt = downloads[0]?.downloadedAt ?? null;
      }

      const decision = reviewEligibility({
        downloadedAt,
        emailVerified: !!session.user.emailVerified,
        hasReviewed: existing !== undefined,
        kind: project.type === "server" ? "server" : "project",
        signedIn: true,
      });

      if (!decision.eligible) {
        throw new Error(
          refusalMessage(decision.reason) ?? REVIEW_MESSAGES.unavailable
        );
      }

      const [review] = await tx
        .insert(projectReviews)
        .values({
          comment: data.comment || null,
          projectId: project.id,
          rating: data.rating,
          userId: session.user.id,
        })
        .returning();

      if (!review) {
        throw new Error("Review could not be recorded.");
      }

      return {
        authorName: session.user.name,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        id: review.id,
        rating: review.rating,
      };
    });
  });
