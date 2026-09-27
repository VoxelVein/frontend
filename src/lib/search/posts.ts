import { sql } from "drizzle-orm";
import {
  array,
  boolean,
  nullable,
  number,
  object,
  safeParse,
  string,
} from "valibot";
import type { InferOutput } from "valibot";

import { db } from "@/db";
import { resolvePreview } from "@/lib/posts";
import type { PostSummary } from "@/lib/posts";
import { matchPost, rankPost, toTextQuery } from "@/lib/search/text";

const SEARCH_LIMIT = 50;

export interface PostSearchOptions {
  /**
   * Whether drafts are included. Only the admin path may set this; the public
   * path hardcodes it to false so a draft can never leak to an anonymous caller.
   */
  includeUnpublished?: boolean;
  query: string;
}

export interface PostSearchResult {
  estimatedTotalHits: number;
  hits: PostSummary[];
  query: string;
}

/** One hit as `jsonb_agg` renders it. `excerpt` is nullable in the schema. */
const postHitSchema = object({
  content: string(),
  createdAt: string(),
  excerpt: nullable(string()),
  id: string(),
  published: boolean(),
  slug: string(),
  title: string(),
  updatedAt: string(),
});

type PostHit = InferOutput<typeof postHitSchema>;

const postSearchRowSchema = object({
  estimatedTotalHits: number(),
  hits: array(postHitSchema),
});

const toSummaries = (hits: PostHit[]): PostSummary[] =>
  // `content` is dropped from the result: it is read only to derive the teaser,
  // and shipping every matching body to the browser would defeat the point of
  // searching on it.
  hits.map(({ content, ...hit }) => ({
    ...hit,
    // `to_jsonb` renders a `timestamp` with no zone and no milliseconds, which
    // would then parse as local time and show the wrong day. Re-serialising
    // through `Date` pins it to UTC.
    createdAt: new Date(hit.createdAt).toISOString(),
    updatedAt: new Date(hit.updatedAt).toISOString(),
    preview: resolvePreview({ content, excerpt: hit.excerpt }),
  }));

/**
 * Searches blog posts in Postgres.
 *
 * Reading the table means there is no derived copy to drift out of sync, and
 * no reindex step is needed after a deploy.
 */
export const searchPostsInDatabase = async ({
  includeUnpublished = false,
  query,
}: PostSearchOptions): Promise<PostSearchResult> => {
  const q = query.trim();
  const textQuery = toTextQuery(q);
  const isSearching = q.length > 0;

  const result = await db.execute(sql`
    with matched as (
      select
        posts.content,
        posts.created_at as "createdAt",
        posts.excerpt,
        posts.id,
        posts.published,
        posts.slug,
        posts.title,
        posts.updated_at as "updatedAt",
        ${isSearching ? sql`${rankPost(q, textQuery)}` : sql`0`} as rank
      from posts
      where ${includeUnpublished ? sql`true` : sql`posts.published = true`}
        ${isSearching ? sql`and ${matchPost(q, textQuery)}` : sql``}
    )
    select
      (select count(*)::int from matched) as "estimatedTotalHits",
      coalesce(
        (
          select jsonb_agg(
            to_jsonb(paged) - 'rank'
            order by paged.rank desc, paged."createdAt" desc, paged.id
          )
          from (
            select * from matched
            order by rank desc, "createdAt" desc, id
            limit ${SEARCH_LIMIT}
          ) paged
        ),
        '[]'::jsonb
      ) as hits
  `);

  const [row] = result.rows;
  const parsed = safeParse(postSearchRowSchema, row);

  // The query is hand-written SQL, so a schema mismatch is a bug rather than bad
  // user input. Throwing would turn a search failure into a 500, so an unreadable
  // result set degrades to "no matches" and the blog still renders.
  if (!parsed.success) {
    return { estimatedTotalHits: 0, hits: [], query: q };
  }

  return {
    estimatedTotalHits: parsed.output.estimatedTotalHits,
    hits: toSummaries(parsed.output.hits),
    query: q,
  };
};

/**
 * Whether blog search has anything to search.
 *
 * The blog hides its search field until something is published: an empty search
 * box over an empty blog is a dead control. The old implementation probed the
 * search index, which meant a freshly deployed instance hid search until someone
 * remembered to reindex; asking the table cannot get that wrong.
 */
export const hasSearchablePosts = async (): Promise<boolean> => {
  const result = await db.execute(
    sql`select exists(select 1 from posts where published = true) as present`
  );
  const [row] = result.rows;
  const parsed = safeParse(boolean(), row?.present);

  return parsed.success && parsed.output;
};
