import { Link } from "@tanstack/react-router";

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
 * The post fields a card renders. Both `PostSummary` (from the database) and
 * `PostSearchDocument` (from Meilisearch) satisfy it, so search hits and list
 * entries render through the same component.
 */
export interface PostCardData {
  createdAt: Date | string;
  preview: string;
  slug: string;
  title: string;
}

const PostCard = ({ post }: { post: PostCardData }) => {
  const isoDate = toIsoDate(post.createdAt);

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
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          <time dateTime={isoDate}>
            {dateFormatter.format(new Date(isoDate))}
          </time>
        </p>
      )}

      <h2 className="text-foreground mt-2 text-lg font-semibold tracking-tight">
        {post.title}
      </h2>

      {post.preview ? (
        <p className="text-muted-foreground mt-2 line-clamp-3 text-sm leading-6">
          {post.preview}
        </p>
      ) : null}
    </article>
  );
};

export { PostCard };
