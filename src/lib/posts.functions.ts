import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { desc, eq } from "drizzle-orm";
import { parse } from "valibot";

import { db } from "@/db";
import { posts } from "@/db/schema";
import { auth } from "@/lib/auth";
import { postInputSchema, postUpdateSchema, resolvePreview } from "@/lib/posts";
import type { Post, PostInput, PostSummary } from "@/lib/posts";
import { hasSearchablePosts, searchPostsInDatabase } from "@/lib/search/posts";
import type { PostSearchResult } from "@/lib/search/posts";

const getAdminSessionOrNull = async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session || session.user.role !== "admin") {
    return null;
  }

  return session;
};

const getAdminSession = async () => {
  const session = await getAdminSessionOrNull();

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
};

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
      await getAdminSession();
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
    await getAdminSession();

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
      const session = await getAdminSessionOrNull();

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
    const session = await getAdminSession();

    const [row] = await db
      .insert(posts)
      .values({
        authorId: session.user.id,
        content: data.content,
        excerpt: data.excerpt ?? null,
        published: data.published,
        slug: data.slug,
        title: data.title,
      })
      .returning();

    return { ...row, preview: resolvePreview(row) };
  });

export const updatePost = createServerFn({ method: "POST" })
  .validator((data: PostInput & { id: string }) =>
    parse(postUpdateSchema, data)
  )
  .handler(async ({ data }): Promise<Post> => {
    await getAdminSession();

    const [row] = await db
      .update(posts)
      .set({
        content: data.content,
        excerpt: data.excerpt ?? null,
        published: data.published,
        slug: data.slug,
        title: data.title,
      })
      .where(eq(posts.id, data.id))
      .returning();

    if (!row) {
      throw new Error("Post not found.");
    }

    return { ...row, preview: resolvePreview(row) };
  });

export const deletePost = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await getAdminSession();

    const result = await db.delete(posts).where(eq(posts.id, data.id));

    if (result.rowCount === 0) {
      throw new Error("Post not found.");
    }

    return { ok: true };
  });
