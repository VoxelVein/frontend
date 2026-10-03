import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { postAuthors, users } from "@/db/schema";
import type { PostAuthor } from "@/lib/posts";

/**
 * Everything that reads or writes the `post_authors` table lives here.
 *
 * The blog listing, the search index, and the post page all need the byline, and
 * search is imported *by* the module that serves the listing — so a shared
 * query placed in either would be an import cycle. One module owning the table
 * keeps that from being tempting.
 */

/**
 * The roles whose members may be credited as a post's authors.
 *
 * A byline names a person taking responsibility for what is published under the
 * VoxelVein name, so it is restricted to staff rather than left open to any
 * account. Enforced here rather than in the editor form because the form is not
 * the boundary — a crafted request reaches the server function directly.
 */
export const AUTHOR_ROLES = ["admin", "moderator"] as const;

/**
 * The credited authors of each given post, in byline order.
 *
 * One query for the whole batch rather than one per post: the blog index renders
 * a card per post and search returns up to fifty hits, so a query per row would
 * make both scale with the size of the blog.
 *
 * A post with no rows is absent from the map rather than mapped to an empty list,
 * so callers can tell "no authors recorded" from "authors never looked up". The
 * migration backfilled every existing post, so that case should not arise.
 */
export const resolveAuthors = async (
  postIds: string[]
): Promise<Map<string, PostAuthor[]>> => {
  const byPost = new Map<string, PostAuthor[]>();

  if (postIds.length === 0) {
    return byPost;
  }

  const rows = await db
    .select({
      image: users.image,
      name: users.name,
      postId: postAuthors.postId,
      userId: postAuthors.userId,
      username: users.username,
    })
    .from(postAuthors)
    .innerJoin(users, eq(users.id, postAuthors.userId))
    .where(inArray(postAuthors.postId, postIds))
    .orderBy(asc(postAuthors.postId), asc(postAuthors.position));

  for (const { postId, userId, name, image, username } of rows) {
    const authors = byPost.get(postId) ?? [];
    authors.push({ id: userId, image, name, username });
    byPost.set(postId, authors);
  }

  return byPost;
};

/**
 * Validates a requested byline and returns it de-duplicated in the given order.
 *
 * The whole request is rejected rather than silently dropping the offending ids,
 * so a bad id cannot quietly publish a post with fewer authors than asked for —
 * which would look like the site lost credit for someone's work.
 */
export const requireAuthorIds = async (
  requested: string[]
): Promise<string[]> => {
  const authorIds = [...new Set(requested)];

  if (authorIds.length === 0) {
    throw new Error("Choose at least one author.");
  }

  const staff = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(inArray(users.id, authorIds), inArray(users.role, AUTHOR_ROLES))
    );

  if (staff.length !== authorIds.length) {
    throw new Error("Post authors must be an admin or a moderator.");
  }

  return authorIds;
};

/**
 * Replaces a post's byline.
 *
 * Delete-then-insert rather than a diff: a byline is a handful of rows that are
 * only ever written as a set, so reconciling them individually would buy nothing
 * but ways to get it wrong. `position` is the array index, so 0 leads.
 */
export const writeAuthors = async (
  postId: string,
  authorIds: string[]
): Promise<void> => {
  await db.delete(postAuthors).where(eq(postAuthors.postId, postId));
  await db
    .insert(postAuthors)
    .values(
      authorIds.map((userId, position) => ({ position, postId, userId }))
    );
};
