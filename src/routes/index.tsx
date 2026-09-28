import { createFileRoute } from "@tanstack/react-router";

import { ExploreSection } from "@/components/explore-section";
import { Hero } from "@/components/hero";
import { NewsSection } from "@/components/news-section";
import { TrendingProjects } from "@/components/trending-projects";
import { Skeleton } from "@/components/ui/skeleton";
import { getLatestPosts } from "@/lib/posts.functions";
import { getTrendingProjects } from "@/lib/trending.functions";

/**
 * The home page while its two loader queries are in flight.
 *
 * The hero and the explore grid are static, so they render for real and only
 * the two data-backed sections are stubbed. Replacing the whole page with
 * skeletons would throw away the one screen that needs no data at all and make
 * the page feel emptier than the real thing.
 */
const HomeSkeleton = () => (
  <div aria-busy="true">
    <Hero />
    {/* Plain divs, not sections: a skeleton has no heading to label a
        section with, and aria-labelledby pointing at an id that is not on
        the page is worse than no label at all. */}
    <div className="px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-4 h-5 w-96 max-w-full" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
    <ExploreSection />
    <div className="px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="mt-4 h-5 w-72 max-w-full" />
        <Skeleton className="mt-8 h-40 w-full rounded-xl" />
      </div>
    </div>
  </div>
);

const HomePage = () => {
  // oxlint-disable-next-line no-use-before-define -- Route must be exported after the component for TanStack Router; HomePage only executes after Route is initialized
  const { latestPosts, trending } = Route.useLoaderData();

  return (
    <>
      <Hero />
      <TrendingProjects initialProjects={trending} />
      <ExploreSection />
      <NewsSection initialPosts={latestPosts} />
    </>
  );
};

export const Route = createFileRoute("/")({
  pendingComponent: HomeSkeleton,
  component: HomePage,
  // Both lists are read from Postgres in parallel, so the home page never waits
  // on a search index that may not be built yet.
  loader: async () => {
    const [latestPosts, trending] = await Promise.all([
      getLatestPosts(),
      getTrendingProjects(),
    ]);

    return { latestPosts, trending };
  },
});
