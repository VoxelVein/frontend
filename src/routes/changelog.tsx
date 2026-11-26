import { createFileRoute } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";

import { ReleaseTimeline } from "@/components/changelog/release-timeline";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReleaseView } from "@/lib/github-releases";
import { listGithubReleases } from "@/lib/github-releases.functions";
import { socialMeta } from "@/lib/site";

const DESCRIPTION =
  "Every VoxelVein release, from the first ALPHA tag onwards, in one filterable timeline.";

interface ChangelogLoaderData {
  releases: ReleaseView[];
}

const ChangelogPage = () => {
  const { releases } = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <PageHeader description={DESCRIPTION} title="Changelog" />

      <div className="mt-10">
        <ReleaseTimeline releases={releases} />
      </div>
    </div>
  );
};

const ChangelogSkeleton = () => (
  <div
    aria-busy="true"
    className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8"
  >
    <Skeleton className="h-9 w-40" />
    <Skeleton className="mt-3 h-5 w-96 max-w-full" />
    <div className="mt-10 flex flex-wrap gap-2">
      <Skeleton className="h-9 w-28 rounded-lg" />
      <Skeleton className="h-9 w-24 rounded-lg" />
      <Skeleton className="h-9 w-20 rounded-lg" />
      <Skeleton className="h-9 w-24 rounded-lg" />
    </div>
    <div className="mt-10 grid gap-10 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <Skeleton className="hidden h-60 w-full lg:block" />
      <div className="ml-2 border-l pl-7">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-3 h-4 w-28" />
        <Skeleton className="mt-6 h-40 w-full" />
        <Skeleton className="mt-12 h-6 w-40" />
        <Skeleton className="mt-3 h-40 w-full" />
      </div>
    </div>
  </div>
);

/** A failed API call must offer a way back without a browser refresh. */
const ChangelogUnavailable = ({ error, reset }: ErrorComponentProps) => (
  <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
    <PageHeader
      title="Changelog unavailable"
      description={
        error instanceof Error
          ? error.message
          : "GitHub releases could not be loaded."
      }
    />
    <div className="mt-6">
      <Button onClick={reset} size="sm" variant="outline">
        Try again
      </Button>
    </div>
  </div>
);

export const Route = createFileRoute("/changelog")({
  pendingComponent: ChangelogSkeleton,
  loader: async (): Promise<ChangelogLoaderData> => ({
    releases: await listGithubReleases(),
  }),
  errorComponent: ChangelogUnavailable,
  head: ({ match }) => ({
    meta: [
      { title: "Changelog | VoxelVein" },
      ...socialMeta({
        description: DESCRIPTION,
        path: match.pathname,
        title: "Changelog | VoxelVein",
      }),
    ],
  }),
  component: ChangelogPage,
});
