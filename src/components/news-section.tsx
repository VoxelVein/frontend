import { IconArrowRight, IconNews } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { PostAuthors } from "@/components/blog/post-authors";
import { PostCategoryBadge } from "@/components/blog/post-category";
import { EmptyState } from "@/components/empty-state";
import { Reveal } from "@/components/reveal";
import { buttonVariants } from "@/components/ui/button-variants";
import type { PostSummary } from "@/lib/posts";
import { getLatestPosts, POSTS_REFRESH_MS } from "@/lib/posts.functions";
import { cn } from "@/lib/utils";

interface NewsSectionProps {
  /** Server-rendered list, so the section never flashes empty. */
  initialPosts: PostSummary[];
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

/**
 * A post's date as a `<time>` value, or null when the timestamp is unusable.
 *
 * The formatting is pinned to UTC rather than the visitor's zone. These are
 * publication dates, and a dispatch ledger whose first column shifts by a day
 * depending on where you are is not a ledger.
 */
const toIsoDate = (value: Date | string): string | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const NewsDate = ({ value }: { value: Date | string }) => {
  const isoDate = toIsoDate(value);

  return (
    <time
      className="text-muted-foreground text-sm tabular-nums"
      dateTime={isoDate ?? undefined}
    >
      {isoDate === null ? "" : dateFormatter.format(new Date(isoDate))}
    </time>
  );
};

/**
 * The newest post, given the room a lead story actually needs.
 *
 * It is a separate component from the ledger rows because it is a different
 * shape, not a bigger version of the same one: the preview is allowed to run to
 * full length here and to a single clamped line down below.
 */
const LeadPost = ({ post }: { post: PostSummary }) => (
  <li>
    <article className="border-border bg-card focus-within:border-foreground/30 relative rounded-2xl border p-6 transition-colors duration-200 motion-reduce:transition-none sm:p-7">
      {/* The whole card is the target, but it stays a real link so it is
          reachable by keyboard and announced with the post it leads to. */}
      <Link
        className="focus-visible:ring-ring focus-visible:ring-ring/50 absolute inset-0 z-10 rounded-2xl focus-visible:ring-3 focus-visible:outline-none"
        params={{ slug: post.slug }}
        preload="intent"
        to="/blog/$slug"
      >
        <span className="sr-only">Read {post.title}</span>
      </Link>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <NewsDate value={post.createdAt} />
        <PostCategoryBadge category={post.category} variant="subtle" />
      </div>
      <h3 className="text-foreground mt-2 max-w-prose text-xl font-semibold tracking-tight text-balance sm:text-2xl">
        {post.title}
      </h3>
      {post.preview ? (
        <p className="text-muted-foreground mt-3 max-w-prose text-sm leading-6 sm:text-base">
          {post.preview}
        </p>
      ) : null}
      <div className="mt-4">
        <PostAuthors authors={post.authors} compact linked={false} />
      </div>
    </article>
  </li>
);

/** One dated line in the ledger, below the lead story. */
const LedgerPost = ({ post }: { post: PostSummary }) => (
  <li>
    <article className="group relative py-5 transition-colors duration-200 motion-reduce:transition-none">
      <Link
        className="focus-visible:ring-ring focus-visible:ring-ring/50 absolute inset-0 z-10 rounded-lg focus-visible:ring-3 focus-visible:outline-none"
        params={{ slug: post.slug }}
        preload="intent"
        to="/blog/$slug"
      >
        <span className="sr-only">Read {post.title}</span>
      </Link>

      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
        {/* A fixed date column is what makes this read as a ledger rather than
            another list of cards. */}
        <div className="shrink-0 sm:w-32">
          <NewsDate value={post.createdAt} />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-foreground text-base font-semibold tracking-tight text-balance">
            {post.title}
          </h3>
          {/* Category and byline on one line, under the title: at ledger width
              they are the only way to tell a security advisory apart from a
              company announcement without opening it. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <PostCategoryBadge category={post.category} variant="subtle" />
            <PostAuthors authors={post.authors} compact linked={false} />
          </div>
          {post.preview ? (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-6">
              {post.preview}
            </p>
          ) : null}
        </div>

        <IconArrowRight
          aria-hidden
          className="text-muted-foreground hidden shrink-0 self-center transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none sm:block"
          size={16}
        />
      </div>
    </article>
  </li>
);

const NewsSection = ({ initialPosts }: NewsSectionProps) => {
  const { data: posts = initialPosts } = useQuery({
    initialData: initialPosts,
    queryFn: () => getLatestPosts(),
    queryKey: ["latest-posts"],
    refetchInterval: POSTS_REFRESH_MS,
    staleTime: POSTS_REFRESH_MS,
  });

  // Three posts arrive in a fixed order, so the split is stable across renders
  // and the lead story is always the newest one.
  const [lead, ...rest] = posts;

  return (
    <section
      aria-labelledby="news-heading"
      className="px-4 py-12 sm:px-6 sm:py-14 lg:px-8"
      id="news"
    >
      {/* One reveal for the whole section, so the heading and the posts
          arrive together instead of the heading leading on its own. */}
      <Reveal className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h2
              className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl"
              id="news-heading"
            >
              News
            </h2>
            <p className="text-muted-foreground mt-2 max-w-prose text-sm sm:text-base">
              Release notes and announcements from the team.
            </p>
          </div>

          <Link
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "min-h-11 shrink-0"
            )}
            preload="intent"
            to="/blog"
          >
            All posts
            <IconArrowRight aria-hidden size={16} />
          </Link>
        </div>

        {lead === undefined ? (
          <EmptyState
            // No action: the header link above already goes to /blog. This
            // state used to render a second one reading "Visit the blog", so an
            // empty section offered the same destination under two names.
            description="Once the team publishes an update, the newest posts show up here."
            icon={<IconNews aria-hidden size={24} />}
            title="No posts yet"
            variant="inline"
          />
        ) : (
          <ol aria-label="Latest blog posts" className="mt-8">
            <LeadPost post={lead} />
            {rest.length > 0 ? (
              <li aria-hidden className="mt-2">
                {/* The rule divides the two kinds of entry, so it is decoration
                    rather than a list item and is hidden from the count. */}
                <hr className="border-border/70 border-t" />
              </li>
            ) : null}
            {rest.map((post) => (
              <LedgerPost key={post.id} post={post} />
            ))}
          </ol>
        )}
      </Reveal>
    </section>
  );
};

export { NewsSection };
