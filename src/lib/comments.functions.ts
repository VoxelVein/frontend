import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, count, eq, inArray } from "drizzle-orm";
import {
  check,
  maxLength,
  minLength,
  object,
  optional,
  parse,
  pipe,
  string,
  trim,
  uuid,
} from "valibot";

import { db } from "@/db";
import {
  commentHearts,
  comments,
  posts,
  projectReviews,
  projects,
  users,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { COMMENT_MAX_LENGTH, REVIEW_RESPONSE_MAX_LENGTH } from "@/lib/comments";
import {
  CONTENT_FILTER_MESSAGE,
  containsBlockedWord,
} from "@/lib/content-filter";
import { DELETED_USER_LABEL } from "@/lib/projects";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  consumeServerLimit,
  rateLimitIdentity,
  RATE_LIMIT_MESSAGE,
} from "@/lib/rate-limit-server";
import { requireCapability } from "@/lib/role-guards";

/**
 * Comments on blog posts and the creator's replies to reviews.
 *
 * Authorization is entirely server-side here: a reply form can be hidden in
 * the UI, but the request is still one curl call away. Writers must be signed
 * in, posts must be published, only the project owner may answer a review,
 * and only staff may heart a comment.
 */

const WRITE_BUCKET = "comments-write";

export interface CommentView {
  authorName: string;
  /** Read at render time, so a role change is reflected in existing comments. */
  authorRole: string | null;
  body: string;
  createdAt: string;
  heartCount: number;
  heartedByMe: boolean;
  id: string;
  parentId: string | null;
  postId: string | null;
}

export interface ReviewResponseView {
  authorName: string;
  authorRole: string | null;
  body: string;
  createdAt: string;
  heartCount: number;
  heartedByMe: boolean;
  id: string;
  reviewId: string;
}

const commentFields = {
  authorName: users.name,
  authorRole: users.role,
  body: comments.body,
  createdAt: comments.createdAt,
  id: comments.id,
  parentId: comments.parentId,
  postId: comments.postId,
  reviewId: comments.reviewId,
};

/** Heart totals and whether the reader gave one, for a set of comments. */
const heartsFor = async (
  ids: readonly string[],
  userId: string | undefined
): Promise<Map<string, { count: number; mine: boolean }>> => {
  const hearts = new Map<string, { count: number; mine: boolean }>();

  if (ids.length === 0) {
    return hearts;
  }

  const [totals, given] = await Promise.all([
    db
      .select({ commentId: commentHearts.commentId, total: count() })
      .from(commentHearts)
      .where(inArray(commentHearts.commentId, [...ids]))
      .groupBy(commentHearts.commentId),
    userId
      ? db
          .select({ commentId: commentHearts.commentId })
          .from(commentHearts)
          .where(
            and(
              inArray(commentHearts.commentId, [...ids]),
              eq(commentHearts.userId, userId)
            )
          )
      : Promise.resolve([]),
  ]);

  const givenIds = new Set(given.map((heart) => heart.commentId));

  for (const total of totals) {
    hearts.set(total.commentId, {
      count: Number(total.total),
      mine: givenIds.has(total.commentId),
    });
  }

  return hearts;
};

const heartView = (
  hearts: Map<string, { count: number; mine: boolean }>,
  id: string
) => ({
  heartCount: hearts.get(id)?.count ?? 0,
  heartedByMe: hearts.get(id)?.mine ?? false,
});

const requirePublishedPost = async (postId: string) => {
  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.published, true)))
    .limit(1);

  if (!post) {
    throw new Error("This post is unavailable.");
  }

  return post;
};

const bodySchema = (maximum: number) =>
  pipe(
    string(),
    trim(),
    minLength(1, "Write a comment first."),
    maxLength(maximum, `Keep comments under ${maximum} characters.`),
    check((value) => !containsBlockedWord(value), CONTENT_FILTER_MESSAGE)
  );

interface PostCommentInput {
  body: string;
  parentId?: string;
  postId: string;
}

const postCommentSchema = object({
  body: bodySchema(COMMENT_MAX_LENGTH),
  parentId: optional(pipe(string(), uuid())),
  postId: string(),
});

/** Public read for the comment thread under a published post. */
export const listPostComments = createServerFn({ method: "GET" })
  .validator((data: { postId: string }) =>
    parse(object({ postId: string() }), data)
  )
  .handler(async ({ data }): Promise<CommentView[]> => {
    const post = await requirePublishedPost(data.postId);
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });

    if (
      await consumeServerLimit(
        "comments-read",
        rateLimitIdentity(headers, process.env.TRUST_PROXY === "true"),
        RATE_LIMITS.read
      )
    ) {
      throw new Error(RATE_LIMIT_MESSAGE);
    }

    const rows = await db
      .select(commentFields)
      .from(comments)
      .leftJoin(users, eq(users.id, comments.authorId))
      .where(eq(comments.postId, post.id))
      .orderBy(comments.createdAt);

    const hearts = await heartsFor(
      rows.map((row) => row.id),
      session?.user.id
    );

    return rows.map((row) => ({
      authorName: row.authorName ?? DELETED_USER_LABEL,
      authorRole: row.authorRole,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      ...heartView(hearts, row.id),
      id: row.id,
      parentId: row.parentId,
      postId: row.postId,
    }));
  });

/** Adds a top-level comment or a reply to any comment on the post. */
export const createPostComment = createServerFn({ method: "POST" })
  .validator((data: PostCommentInput) => parse(postCommentSchema, data))
  .handler(async ({ data }): Promise<CommentView> => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });

    if (!session) {
      throw new Error("Sign in to comment.");
    }

    if (session.user.banned) {
      throw new Error("Your account cannot comment.");
    }

    if (
      await consumeServerLimit(
        WRITE_BUCKET,
        rateLimitIdentity(
          headers,
          process.env.TRUST_PROXY === "true",
          session.user.id
        ),
        RATE_LIMITS.write
      )
    ) {
      throw new Error(RATE_LIMIT_MESSAGE);
    }

    const post = await requirePublishedPost(data.postId);

    if (data.parentId) {
      const [parent] = await db
        .select({ id: comments.id })
        .from(comments)
        .where(
          and(eq(comments.id, data.parentId), eq(comments.postId, post.id))
        )
        .limit(1);

      if (!parent) {
        throw new Error("That comment is unavailable.");
      }
    }

    const [comment] = await db
      .insert(comments)
      .values({
        authorId: session.user.id,
        body: data.body,
        parentId: data.parentId ?? null,
        postId: post.id,
        reviewId: null,
        targetKind: "post",
      })
      .returning();

    if (!comment) {
      throw new Error("Comment could not be recorded.");
    }

    return {
      authorName: session.user.name,
      authorRole: session.user.role ?? null,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      heartCount: 0,
      heartedByMe: false,
      id: comment.id,
      parentId: comment.parentId ?? null,
      postId: comment.postId ?? null,
    };
  });

/** Responses to a page of reviews, keyed by the review they answer. */
export const responsesForReviews = async (
  reviewIds: readonly string[],
  userId?: string
): Promise<ReviewResponseView[]> => {
  if (reviewIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ ...commentFields, reviewId: comments.reviewId })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(
      and(
        eq(comments.targetKind, "review"),
        inArray(comments.reviewId, [...reviewIds])
      )
    )
    .orderBy(comments.createdAt);

  const hearts = await heartsFor(
    rows.map((row) => row.id),
    userId
  );

  return rows
    .filter(
      (row): row is typeof row & { reviewId: string } => row.reviewId !== null
    )
    .map((row) => ({
      authorName: row.authorName ?? DELETED_USER_LABEL,
      authorRole: row.authorRole,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      ...heartView(hearts, row.id),
      id: row.id,
      reviewId: row.reviewId,
    }));
};

interface ReviewResponseInput {
  body: string;
  reviewId: string;
}

const reviewResponseSchema = object({
  body: bodySchema(REVIEW_RESPONSE_MAX_LENGTH),
  reviewId: pipe(string(), uuid()),
});

/** Only the project's creator may answer a review, and only once. */
export const createReviewResponse = createServerFn({ method: "POST" })
  .validator((data: ReviewResponseInput) => parse(reviewResponseSchema, data))
  .handler(async ({ data }): Promise<ReviewResponseView> => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });

    if (!session) {
      throw new Error("Sign in to respond.");
    }

    if (
      await consumeServerLimit(
        WRITE_BUCKET,
        rateLimitIdentity(
          headers,
          process.env.TRUST_PROXY === "true",
          session.user.id
        ),
        RATE_LIMITS.write
      )
    ) {
      throw new Error(RATE_LIMIT_MESSAGE);
    }

    return db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          ownerId: projects.ownerId,
          status: projects.status,
        })
        .from(projectReviews)
        .innerJoin(projects, eq(projects.id, projectReviews.projectId))
        .where(eq(projectReviews.id, data.reviewId))
        .for("update");

      if (!row || row.status !== "published") {
        throw new Error("This review is unavailable.");
      }

      if (row.ownerId !== session.user.id) {
        throw new Error("Only the project creator can respond to a review.");
      }

      const [existing] = await tx
        .select({ id: comments.id })
        .from(comments)
        .where(
          and(
            eq(comments.reviewId, data.reviewId),
            eq(comments.targetKind, "review")
          )
        )
        .limit(1);

      if (existing) {
        throw new Error("You have already responded to this review.");
      }

      const [comment] = await tx
        .insert(comments)
        .values({
          authorId: session.user.id,
          body: data.body,
          parentId: null,
          postId: null,
          reviewId: data.reviewId,
          targetKind: "review",
        })
        .returning();

      if (!comment) {
        throw new Error("Response could not be recorded.");
      }

      return {
        authorName: session.user.name,
        authorRole: session.user.role ?? null,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        heartCount: 0,
        heartedByMe: false,
        id: comment.id,
        reviewId: comment.reviewId ?? data.reviewId,
      };
    });
  });

const heartSchema = object({ commentId: pipe(string(), uuid()) });

/** Staff endorsement of a comment. A second tap removes the same heart. */
export const toggleCommentHeart = createServerFn({ method: "POST" })
  .validator((data: { commentId: string }) => parse(heartSchema, data))
  .handler(
    async ({ data }): Promise<{ heartCount: number; hearted: boolean }> => {
      const session = await requireCapability("heartComments");
      const headers = getRequestHeaders();

      if (
        await consumeServerLimit(
          WRITE_BUCKET,
          rateLimitIdentity(
            headers,
            process.env.TRUST_PROXY === "true",
            session.user.id
          ),
          RATE_LIMITS.write
        )
      ) {
        throw new Error(RATE_LIMIT_MESSAGE);
      }

      const [comment] = await db
        .select({ id: comments.id })
        .from(comments)
        .where(eq(comments.id, data.commentId))
        .limit(1);

      if (!comment) {
        throw new Error("That comment is unavailable.");
      }

      return db.transaction(async (tx) => {
        const [existing] = await tx
          .delete(commentHearts)
          .where(
            and(
              eq(commentHearts.commentId, comment.id),
              eq(commentHearts.userId, session.user.id)
            )
          )
          .returning({ commentId: commentHearts.commentId });

        const hearted = existing === undefined;

        if (hearted) {
          await tx
            .insert(commentHearts)
            .values({ commentId: comment.id, userId: session.user.id });
        }

        const [total] = await tx
          .select({ total: count() })
          .from(commentHearts)
          .where(eq(commentHearts.commentId, comment.id));

        return { heartCount: Number(total?.total ?? 0), hearted };
      });
    }
  );
