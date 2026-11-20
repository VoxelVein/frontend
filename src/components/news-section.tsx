import { IconArrowRight, IconNews } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { PostAuthors } from "@/components/blog/post-authors";
import { PostCategoryBadge } from "@/components/blog/post-category";
import { EmptyState } from "@/components/empty-state";
import { Reveal } from "@/components/reveal";
import { buttonVariants } from "@/components/ui/button-variants";
import type { PostSummary } from "@/lib/posts";
import { truncate } from "@/lib/posts";
import { getLatestPosts, POSTS_REFRESH_MS } from "@/lib/posts.functions";
import { staggerDelay } from "@/lib/reveal-stagger";
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

/** The decorative "Read more" cue at the end of a card. */
const ReadMore = ({ className }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={cn(
      "text-primary inline-flex shrink-0 items-center gap-1 text-sm font-medium",
      className
    )}
  >
    Read more
    <IconArrowRight
      aria-hidden
      className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
      size={16}
    />
  </span>
);

/**
 * The newest post, given the room a lead story needs.
 *
 * Keyframe entrance like the hero: it lands first, then the older posts
 * stagger in behind it. The whole card responds to the pointer - border
 * warms on hover, and a press scales the card down a hair.
 */
const LeadPost = ({ post }: { post: PostSummary }) => (
  <li className="min-w-0 sm:col-span-2">
    <article className="border-border bg-card focus-within:border-primary/30 hover:border-primary/30 group animate-news-lead relative max-w-full rounded-xl border p-6 transition-colors duration-300 active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 sm:p-8">
      <Link
        className="focus-visible:ring-ring focus-visible:ring-ring/50 absolute inset-0 z-10 rounded-xl focus-visible:ring-3 focus-visible:outline-none"
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
      <h3 className="text-foreground mt-2 truncate text-2xl font-bold tracking-tight sm:text-3xl">
        {post.title}
      </h3>
      {post.preview ? (
        <p className="text-muted-foreground mt-4 max-w-2xl text-sm leading-7 sm:text-base">
          {truncate(post.preview, 140)}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <PostAuthors authors={post.authors} compact linked={false} />
        <div className="flex items-center gap-2">
          <ReadMore className="group-hover:text-primary/90" />
        </div>
      </div>
    </article>
  </li>
);

/**
 * One older post, as a compact card with its own staggered reveal.
 */
const OlderPost = ({ post }: { post: PostSummary }) => (
  <article className="border-border bg-card focus-within:border-primary/30 hover:border-primary/30 group relative flex h-full flex-col rounded-xl border p-6 transition-colors duration-300 active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100">
    <Link
      className="focus-visible:ring-ring focus-visible:ring-ring/50 absolute inset-0 z-10 rounded-xl focus-visible:ring-3 focus-visible:outline-none"
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
    <h3 className="text-foreground mt-2 truncate text-lg font-semibold tracking-tight">
      {post.title}
    </h3>
    {post.preview ? (
      <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-6">
        {post.preview}
      </p>
    ) : null}
    <div className="mt-5 flex items-center justify-between gap-x-4 gap-y-3">
      <PostAuthors authors={post.authors} compact linked={false} />
      <div className="flex items-center gap-2">
        <ReadMore className="group-hover:text-primary/90" />
      </div>
    </div>
  </article>
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
      className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
      id="news"
    >
      <Reveal className="mx-auto max-w-5xl" delay={0.1}>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b pb-8">
          <div>
            <h2
              className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl"
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
              "ease-smooth min-h-11 shrink-0 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
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
            description="Once the team publishes an update, the newest posts show up here."
            icon={<IconNews aria-hidden size={24} />}
            title="No posts yet"
            variant="inline"
          />
        ) : (
          <ol
            aria-label="Latest blog posts"
            className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
          >
            <li
              key={lead.id}
              className="col-span-full flex min-w-0 sm:col-span-2"
            >
              <Reveal className="h-full" delay={0.2}>
                <LeadPost post={lead} />
              </Reveal>
            </li>
            {rest.map((post, index) => (
              <li key={post.id} className="flex min-w-0">
                <Reveal
                  className="h-full flex-1"
                  delay={staggerDelay(index + 1)}
                >
                  <OlderPost post={post} />
                </Reveal>
              </li>
            ))}
          </ol>
        )}
      </Reveal>
    </section>
  );
};

export { NewsSection };
