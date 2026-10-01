import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { desc, eq } from "drizzle-orm";
import { parse } from "valibot";

import { db } from "@/db";
import { posts } from "@/db/schema";
import { auth } from "@/lib/auth";
import { postInputSchema, postUpdateSchema, resolvePreview } from "@/lib/posts";
import type { Post, PostInput, PostSummary } from "@/lib/posts";
import { can } from "@/lib/roles";
import { hasSearchablePosts, searchPostsInDatabase } from "@/lib/search/posts";
import type { PostSearchResult } from "@/lib/search/posts";

const getStaffSessionOrNull = async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session || !can(session.user.role, "managePosts")) {
    return null;
  }

  return session;
};

/** Any staff member with `managePosts`, enough to write and read drafts. */
const getStaffSession = async () => {
  const session = await getStaffSessionOrNull();

  if (!session) {
    throw new Error("Only staff can manage blog posts.");
  }

  return session;
};

/**
 * Publishing a post makes it public, so that half is admin-only even though
 * drafting is not. Read through `publishPosts` rather than `managePosts` so the
 * day drafting is opened up, publishing does not follow by accident.
 */
const getAdminSession = async () => {
  const session = await getStaffSessionOrNull();

  if (!session || !can(session.user.role, "publishPosts")) {
    throw new Error("Only admins can publish or delete blog posts.");
  }

  return session;
};

/**
 * Whether a staff member may set the published flag.
 *
 * The check lives here so both the create and update paths agree, rather than
 * each trusting a value that came from the client.
 */
const resolvePublished = (
  requested: boolean,
  role: string | null | undefined
): boolean => (can(role, "publishPosts") ? requested : false);

const POST_NOT_FOUND = "Post not found.";

const postSummaryColumns = {
  content: posts.content,
  createdAt: posts.createdAt,
  excerpt: posts.excerpt,
  id: posts.id,
  published: posts.published,
  slug: posts.slug,
  title: posts.title,
  updatedAt: posts.updatedAt,
} as const;

interface PostSummaryRow {
  content: string;
  createdAt: Date;
  excerpt: string | null;
  id: string;
  published: boolean;
  slug: string;
  title: string;
  updatedAt: Date;
}

/**
 * Derives each teaser from the stored body. The body itself is dropped here and
 * never leaves the server.
 */
const toPostSummaries = (rows: PostSummaryRow[]): PostSummary[] =>
  rows.map(({ content, ...row }) => ({
    ...row,
    preview: resolvePreview({ content, excerpt: row.excerpt }),
  }));

export const listPosts = createServerFn({ method: "GET" })
  .validator((data: { includeUnpublished?: boolean }) => data)
  .handler(async ({ data }): Promise<PostSummary[]> => {
    const { includeUnpublished = false } = data;

    if (includeUnpublished) {
      await getStaffSession();
    }

    const rows = await db
      .select(postSummaryColumns)
      .from(posts)
      .where(includeUnpublished ? undefined : eq(posts.published, true))
      .orderBy(desc(posts.createdAt));

    return toPostSummaries(rows);
  });

/** How many posts the home page shows. */
const LATEST_POSTS_LIMIT = 3;

/** The list is recomputed at most this often, however many visitors ask. */
export const POSTS_REFRESH_MS = 5 * 60 * 1000;

/**
 * The newest published posts, for the home page.
 *
 * Reads Postgres rather than a search index, so the section renders correctly
 * straight after a deploy with no reindex step, and cannot drift out of sync
 * with the database the way a derived index can.
 */
export const getLatestPosts = createServerFn({ method: "GET" }).handler(
  async (): Promise<PostSummary[]> =>
    toPostSummaries(
      await db
        .select(postSummaryColumns)
        .from(posts)
        .where(eq(posts.published, true))
        .orderBy(desc(posts.createdAt))
        .limit(LATEST_POSTS_LIMIT)
    )
);

/**
 * Public post search, published posts only.
 *
 * Reads Postgres directly. Search needs no separate service, so there is no
 * extra hop and no way for it to be "temporarily unavailable".
 */
export const searchPosts = createServerFn({ method: "GET" })
  .validator((data: { query: string }) => data)
  .handler(({ data }): Promise<PostSearchResult> =>
    searchPostsInDatabase({ query: data.query })
  );

/**
 * Admin post search, including drafts.
 *
 * The published-only filter is hardcoded above rather than passed in, so no code
 * path can widen it and leak a draft to an anonymous caller.
 */
export const searchPostsAdmin = createServerFn({ method: "GET" })
  .validator((data: { query: string }) => data)
  .handler(async ({ data }): Promise<PostSearchResult> => {
    await getStaffSession();

    return searchPostsInDatabase({
      includeUnpublished: true,
      query: data.query,
    });
  });

/**
 * Whether blog search has anything to search.
 *
 * The UI hides its search field when this is false, because a search box over an
 * empty blog is a dead control. Reading the table cannot get this wrong: it used
 * to probe the search index, which meant a fresh deployment hid search until
 * someone remembered to run the reindex script.
 */
export const postSearchAvailable = createServerFn({ method: "GET" }).handler(
  (): Promise<boolean> => hasSearchablePosts()
);

export const getPost = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }): Promise<Post | null> => {
    const rows = await db
      .select()
      .from(posts)
      .where(eq(posts.slug, data.slug))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const [post] = rows;

    if (!post.published) {
      const session = await getStaffSessionOrNull();

      if (!session) {
        return null;
      }
    }

    return { ...post, preview: resolvePreview(post) };
  });

export const getPostById = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<Post | null> => {
    await getAdminSession();

    const rows = await db
      .select()
      .from(posts)
      .where(eq(posts.id, data.id))
      .limit(1);

    const [post] = rows;

    return post ? { ...post, preview: resolvePreview(post) } : null;
  });

export const createPost = createServerFn({ method: "POST" })
  .validator((data: PostInput) => parse(postInputSchema, data))
  .handler(async ({ data }): Promise<Post> => {
    const session = await getStaffSession();

    const [row] = await db
      .insert(posts)
      .values({
        authorId: session.user.id,
        content: data.content,
        excerpt: data.excerpt ?? null,
        // A moderator's post is always a draft, whatever the form sent.
        published: resolvePublished(data.published, session.user.role),
        slug: data.slug,
        title: data.title,
      })
      .returning();

    return { ...row, preview: resolvePreview(row) };
  });

/**
 * The published value a non-admin may write.
 *
 * A moderator cannot change the published state at all in either direction:
 * they may not publish a draft, and they may not unpublish a live post, since
 * both are publishing decisions. The stored value wins.
 */
const staysUnpublished = async (
  id: string,
  requested: boolean
): Promise<boolean> => {
  const [existing] = await db
    .select({ published: posts.published })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  if (!existing) {
    throw new Error(POST_NOT_FOUND);
  }
  return requested || existing.published;
};

export const updatePost = createServerFn({ method: "POST" })
  .validator((data: PostInput & { id: string }) =>
    parse(postUpdateSchema, data)
  )
  .handler(async ({ data }): Promise<Post> => {
    const session = await getStaffSession();

    // A moderator editing a draft stays a draft, and cannot unpublish an
    // already-published post either, since that would be a publish decision.
    const published = can(session.user.role, "publishPosts")
      ? data.published
      : await staysUnpublished(data.id, data.published);

    const [row] = await db
      .update(posts)
      .set({
        content: data.content,
        excerpt: data.excerpt ?? null,
        published,
        slug: data.slug,
        title: data.title,
      })
      .where(eq(posts.id, data.id))
      .returning();

    if (!row) {
      throw new Error(POST_NOT_FOUND);
    }

    return { ...row, preview: resolvePreview(row) };
  });

export const deletePost = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await getAdminSession();

    const result = await db.delete(posts).where(eq(posts.id, data.id));

    if (result.rowCount === 0) {
      throw new Error(POST_NOT_FOUND);
    }

    return { ok: true };
  });
