import { Link } from "@tanstack/react-router";

import { PostAuthors } from "@/components/blog/post-authors";
import { PostCategoryBadge } from "@/components/blog/post-category";
import { MICRO_LABEL_CLASS } from "@/lib/classes";
import type { PostAuthor } from "@/lib/posts";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

/**
 * Normalizes a timestamp for a `<time>` element, or reports that it is unusable.
 *
 * Search hits carry a timestamp too, but a document indexed before the field
 * existed has none, so an unparseable value is skipped rather than rendered as
 * "Invalid Date".
 */
const toIsoDate = (value: Date | string): string | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * The post fields a card renders. Both `PostSummary` from the database and a
 * search hit satisfy it, so search results and list entries render through the
 * same component.
 */
export interface PostCardData {
  authors: PostAuthor[];
  category: string | null;
  createdAt: Date | string;
  preview: string;
  slug: string;
  title: string;
}

const HEADING_TAGS = { 2: "h2", 3: "h3" } as const;

interface PostCardProps {
  /**
   * Heading level for the post title. Defaults to 2, which is correct on the
   * blog index where the page heading is the `h1`. Pass 3 when the card sits
   * inside a section that already provides an `h2`, so the title nests under it
   * instead of competing with it.
   */
  headingLevel?: 2 | 3;
  post: PostCardData;
}

/**
 * One post in a listing: when it was written, what it is filed under, who wrote
 * it, and what it says.
 *
 * Category and byline are part of the card rather than extra decoration because
 * they are how a reader decides whether to open it: a security post in a
 * changelog-shaped list is a different offer from a company announcement, and
 * "three people wrote this" is worth knowing before committing to the read.
 */
const PostCard = ({ headingLevel = 2, post }: PostCardProps) => {
  const isoDate = toIsoDate(post.createdAt);
  const Heading = HEADING_TAGS[headingLevel];

  return (
    <article className="border-border bg-card focus-within:border-foreground/20 relative flex h-full flex-col rounded-xl border p-5 transition-colors duration-300 focus-within:ring-1 motion-reduce:transition-none">
      {/* The whole card is the click target. It sits above the text so the
          non-interactive content never steals the pointer, while remaining a
          real link so it is reachable and activatable by keyboard. */}
      <Link
        to="/blog/$slug"
        params={{ slug: post.slug }}
        preload="intent"
        className="focus-visible:ring-ring absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="sr-only">Read {post.title}</span>
      </Link>

      <div className="flex items-center gap-2">
        {isoDate === null ? null : (
          <p className={MICRO_LABEL_CLASS}>
            <time dateTime={isoDate}>
              {dateFormatter.format(new Date(isoDate))}
            </time>
          </p>
        )}
        <PostCategoryBadge category={post.category} variant="subtle" />
      </div>

      <Heading className="text-foreground mt-2 text-lg font-semibold tracking-tight text-balance">
        {post.title}
      </Heading>

      {post.preview ? (
        <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-6">
          {post.preview}
        </p>
      ) : null}

      {/* Pushed to the bottom so a card with a short preview and one with a long
          one still line their bylines up across a grid row. */}
      <div className="mt-auto pt-4">
        <PostAuthors authors={post.authors} compact linked={false} />
      </div>
    </article>
  );
};

export { PostCard };
