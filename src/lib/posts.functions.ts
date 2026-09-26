import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { desc, eq } from "drizzle-orm";
import { parse } from "valibot";

import { db } from "@/db";
import { posts } from "@/db/schema";
import { auth } from "@/lib/auth";
import { postInputSchema, postUpdateSchema, resolvePreview } from "@/lib/posts";
import type { Post, PostInput, PostSummary } from "@/lib/posts";
import {
  scheduleReindex,
  scheduleReindexDelete,
  withIndex,
} from "@/lib/posts-index";
import { UNAVAILABLE_POST_SEARCH } from "@/lib/posts-search";
import type {
  PostSearchDocument,
  PostSearchResponse,
} from "@/lib/posts-search";

import env from "../../env.config";

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

export const listPosts = createServerFn({ method: "GET" })
  .validator((data: { includeUnpublished?: boolean }) => data)
  .handler(async ({ data }): Promise<PostSummary[]> => {
    const { includeUnpublished = false } = data;

    if (includeUnpublished) {
      await getAdminSession();
    }

    const rows = await db
      .select({
        content: posts.content,
        createdAt: posts.createdAt,
        excerpt: posts.excerpt,
        id: posts.id,
        published: posts.published,
        slug: posts.slug,
        title: posts.title,
        updatedAt: posts.updatedAt,
      })
      .from(posts)
      .where(includeUnpublished ? undefined : eq(posts.published, true))
      .orderBy(desc(posts.createdAt));

    // The body never leaves the server: it is only used to derive the teaser.
    return rows.map(({ content, ...row }) => ({
      ...row,
      preview: resolvePreview({ content, excerpt: row.excerpt }),
    }));
  });

const SEARCH_TIMEOUT_MS = 8000;

/**
 * Public post search, proxied through the API server so the browser never
 * holds a Meilisearch key.
 *
 * A 503 means Meilisearch is unconfigured or down. That is reported as
 * `available: false` rather than thrown, so callers can hide their search UI
 * instead of showing an error.
 */
export const searchPosts = createServerFn({ method: "GET" })
  .validator((data: { query: string }) => data)
  .handler(async ({ data }): Promise<PostSearchResponse> => {
    const params = new URLSearchParams();

    if (data.query) {
      params.set("q", data.query);
    }

    let response: Response;

    try {
      response = await fetch(
        `${env.API_URL}/api/posts/search?${params.toString()}`,
        { signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) }
      );
    } catch (searchError) {
      throw new Error(
        "Could not reach the search service. Start the API server with `pnpm dev:all` and try again.",
        { cause: searchError }
      );
    }

    if (response.status === 503) {
      return { ...UNAVAILABLE_POST_SEARCH, query: data.query };
    }

    if (!response.ok) {
      throw new Error(`Search failed (${response.status})`);
    }

    // SAFETY: GET /api/posts/search is the only caller of this endpoint and
    // Elysia validates its response shape, so the parsed body is always
    // { available, estimatedTotalHits, hits, query }.
    return response.json() as Promise<PostSearchResponse>;
  });

/**
 * Admin post search, including drafts.
 *
 * Runs against Meilisearch directly rather than through the API server: the
 * public route cannot verify a session, and it hardcodes a published-only
 * filter precisely so drafts can never leak to anonymous callers.
 */
export const searchPostsAdmin = createServerFn({ method: "GET" })
  .validator((data: { query: string }) => data)
  .handler(async ({ data }): Promise<PostSearchResponse> => {
    await getAdminSession();

    const result = await withIndex((index) =>
      index.search<PostSearchDocument>(data.query, {
        limit: 50,
        sort: ["createdAtTs:desc"],
      })
    );

    if (result === null) {
      return { ...UNAVAILABLE_POST_SEARCH, query: data.query };
    }

    return {
      available: true,
      estimatedTotalHits: result.estimatedTotalHits,
      hits: result.hits,
      query: result.query,
    };
  });

/**
 * Whether blog search can actually serve results.
 *
 * The UI hides its search field when this is false, so a Meilisearch outage
 * degrades the page instead of showing a field that does nothing.
 *
 * An index that is reachable but still empty counts as unavailable: the
 * reindex queue only ever sees posts as they are written, so a fresh
 * deployment has an empty index until `pnpm db:reindex:posts` has run. Search
 * that silently returns nothing is worse than no search at all.
 */
export const postSearchAvailable = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    const result = await withIndex((index) => index.search("", { limit: 1 }));

    return result !== null && result.estimatedTotalHits > 0;
  }
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

    scheduleReindex(row);

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

    scheduleReindex(row);

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

    scheduleReindexDelete(data.id);

    return { ok: true };
  });
