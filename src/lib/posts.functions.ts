import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { parse } from "valibot";

import { db } from "@/db";
import { posts, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { readTrustProxy } from "@/lib/client-key";
import {
  AUTHOR_ROLES,
  requireAuthorIds,
  resolveAuthors,
  writeAuthors,
} from "@/lib/post-authors";
import { postInputSchema, postUpdateSchema, resolvePreview } from "@/lib/posts";
import type {
  Post,
  PostInput,
  PostSummary,
  SelectableAuthor,
} from "@/lib/posts";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  consumeServerLimit,
  RATE_LIMIT_MESSAGE,
  rateLimitIdentity,
} from "@/lib/rate-limit-server";
import { can } from "@/lib/roles";
import { hasSearchablePosts, searchPostsInDatabase } from "@/lib/search/posts";
import type { PostSearchResult } from "@/lib/search/posts";

const TRUST_PROXY = readTrustProxy(
  process.env.TRUST_PROXY,
  process.env.NODE_ENV === "production"
);

/**
 * Caps a staff member's writes.
 *
 * Keyed on the account rather than the address: the point is to bound how much
 * content one person can push in a minute, which an address cannot express.
 */
const requireWriteQuota = async (userId: string): Promise<void> => {
  const quota = await consumeServerLimit(
    "post-write",
    `user:${userId}`,
    RATE_LIMITS.write
  );
  if (quota) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }
};

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
  category: posts.category,
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
  category: string | null;
  content: string;
  createdAt: Date;
  excerpt: string | null;
  id: string;
  published: boolean;
  slug: string;
  title: string;
  updatedAt: Date;
}

/** A full post row, as `select()` returns it. */
type PostRow = typeof posts.$inferSelect;

/** Derives each teaser from the stored body and attaches the byline.
 *
 * The body itself is dropped here and never leaves the server.
 */
const toPostSummaries = async (
  rows: PostSummaryRow[]
): Promise<PostSummary[]> => {
  const authorsByPost = await resolveAuthors(rows.map((row) => row.id));

  return rows.map(({ content, ...row }) => ({
    ...row,
    authors: authorsByPost.get(row.id) ?? [],
    preview: resolvePreview({ content, excerpt: row.excerpt }),
  }));
};

/** A single post row plus its teaser and byline. */
const withAuthors = async (post: PostRow): Promise<Post> => {
  const authorsByPost = await resolveAuthors([post.id]);

  return {
    ...post,
    authors: authorsByPost.get(post.id) ?? [],
    preview: resolvePreview(post),
  };
};

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

    return await toPostSummaries(rows);
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
  .handler(async ({ data }): Promise<PostSearchResult> => {
    // Anonymous and uncached, like project search.
    const quota = await consumeServerLimit(
      "post-search",
      rateLimitIdentity(getRequestHeaders(), TRUST_PROXY),
      RATE_LIMITS.read
    );
    if (quota) {
      throw new Error(RATE_LIMIT_MESSAGE);
    }
    return searchPostsInDatabase({ query: data.query });
  });

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

    return withAuthors(post);
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

    return post ? withAuthors(post) : null;
  });

/**
 * Everyone a post may credit, for the editor's author picker.
 *
 * Returned in the same shape the published byline renders, so the editor shows
 * an author exactly as the post page will — including which accounts have no
 * avatar and therefore fall back to initials.
 *
 * Staff-only, because the picker is part of writing a post. Ordered by name so
 * the list cannot reorder under the cursor while an editor is reaching for it.
 *
 * The caller is flagged so the editor can pre-select them for a new post and
 * label them in the list, rather than making a new post start with no byline and
 * relying on the author to remember to add themselves.
 */
export const listSelectableAuthors = createServerFn({
  method: "GET",
}).handler(async (): Promise<SelectableAuthor[]> => {
  const session = await getStaffSession();

  const rows = await db
    .select({
      id: users.id,
      image: users.image,
      name: users.name,
      role: users.role,
      username: users.username,
    })
    .from(users)
    .where(inArray(users.role, AUTHOR_ROLES))
    .orderBy(asc(users.name));

  return rows.map((row) => ({
    ...row,
    isCurrentUser: row.id === session.user.id,
  }));
});

export const createPost = createServerFn({ method: "POST" })
  .validator((data: PostInput) => parse(postInputSchema, data))
  .handler(async ({ data }): Promise<Post> => {
    const session = await getStaffSession();
    await requireWriteQuota(session.user.id);

    // Validated before the insert so a bad byline cannot leave a post row with
    // no authors behind it.
    const authorIds = await requireAuthorIds(data.authorIds);

    const [row] = await db
      .insert(posts)
      .values({
        category: data.category ?? null,
        content: data.content,
        excerpt: data.excerpt ?? null,
        // A moderator's post is always a draft, whatever the form sent.
        published: resolvePublished(data.published, session.user.role),
        slug: data.slug,
        title: data.title,
      })
      .returning();

    await writeAuthors(row.id, authorIds);

    return withAuthors(row);
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
    await requireWriteQuota(session.user.id);
    const authorIds = await requireAuthorIds(data.authorIds);

    // A moderator editing a draft stays a draft, and cannot unpublish an
    // already-published post either, since that would be a publish decision.
    const published = can(session.user.role, "publishPosts")
      ? data.published
      : await staysUnpublished(data.id, data.published);

    const [row] = await db
      .update(posts)
      .set({
        category: data.category ?? null,
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

    await writeAuthors(row.id, authorIds);

    return withAuthors(row);
  });

export const deletePost = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const session = await getAdminSession();
    await requireWriteQuota(session.user.id);

    const result = await db.delete(posts).where(eq(posts.id, data.id));

    if (result.rowCount === 0) {
      throw new Error(POST_NOT_FOUND);
    }

    return { ok: true };
  });
