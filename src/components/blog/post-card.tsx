import { Link } from "@tanstack/react-router";

import { MICRO_LABEL_CLASS } from "@/lib/classes";

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

      {isoDate === null ? null : (
        <p className={MICRO_LABEL_CLASS}>
          <time dateTime={isoDate}>
            {dateFormatter.format(new Date(isoDate))}
          </time>
        </p>
      )}

      <Heading className="text-foreground mt-2 text-lg font-semibold tracking-tight">
        {post.title}
      </Heading>

      {post.preview ? (
        <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-6">
          {post.preview}
        </p>
      ) : null}
    </article>
  );
};

export { PostCard };
