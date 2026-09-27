import { IconArrowRight, IconNews } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { PostCard } from "@/components/blog/post-card";
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

const NewsSection = ({ initialPosts }: NewsSectionProps) => {
  const { data: posts = initialPosts } = useQuery({
    initialData: initialPosts,
    queryFn: () => getLatestPosts(),
    queryKey: ["latest-posts"],
    refetchInterval: POSTS_REFRESH_MS,
    staleTime: POSTS_REFRESH_MS,
  });

  return (
    <section
      aria-labelledby="news-heading"
      className="px-4 py-12 sm:px-6 sm:py-14 lg:px-8"
      id="news"
    >
      <div className="mx-auto max-w-7xl">
        <Reveal className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground mb-2 inline-flex items-center gap-1.5 text-sm font-medium">
              <IconNews aria-hidden size={16} />
              Latest from the blog
            </p>

            <h2
              className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl"
              id="news-heading"
            >
              News
            </h2>

            <p className="text-muted-foreground mt-2 max-w-prose text-sm sm:text-base">
              Announcements and updates from the VoxelVein team.
            </p>
          </div>

          <Link
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "hidden min-h-11 shrink-0 sm:inline-flex"
            )}
            preload="intent"
            to="/blog"
          >
            Browse all
            <IconArrowRight aria-hidden size={16} />
          </Link>
        </Reveal>

        {posts.length === 0 ? (
          <EmptyState
            action={
              <Link
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "min-h-11"
                )}
                to="/blog"
              >
                Visit the blog
              </Link>
            }
            description="Once the team publishes an update, the newest posts show up here."
            icon={<IconNews aria-hidden size={24} />}
            title="No posts yet"
            variant="inline"
          />
        ) : (
          <ol
            aria-label="Latest blog posts"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {posts.map((post, index) => (
              <li key={post.id}>
                <Reveal delay={index * 0.06}>
                  {/* The section heading is already an h2, so the card title
                      nests under it as an h3 rather than competing with it. */}
                  <PostCard headingLevel={3} post={post} />
                </Reveal>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};

export { NewsSection };
