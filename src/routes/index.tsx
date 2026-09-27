import { createFileRoute } from "@tanstack/react-router";

import { ExploreSection } from "@/components/explore-section";
import { Hero } from "@/components/hero";
import { NewsSection } from "@/components/news-section";
import { TrendingProjects } from "@/components/trending-projects";
import { getLatestPosts } from "@/lib/posts.functions";
import { getTrendingProjects } from "@/lib/trending.functions";

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
