import { Markdown } from "@tanstack/markdown/react";
import {
  createFileRoute,
  notFound,
  useLoaderData,
} from "@tanstack/react-router";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ProjectCard } from "@/components/projects/project-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { toPreview } from "@/lib/posts";
import { getPublicProfile } from "@/lib/user-profiles.functions";
import type { PublicProfile } from "@/lib/user-profiles.functions";

/** A profile with no projects still renders; only the grid is replaced. */
const ProfileSkeleton = () => (
  <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14">
    <Skeleton className="h-10 w-64" />
    <Skeleton className="mt-4 h-20 w-full max-w-2xl" />
    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  </div>
);

const ProfileRoute = () => {
  const profile = useLoaderData({ from: "/u/$username" });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14">
      <PageHeader
        title={profile.displayUsername}
        description={`${profile.name} · Joined ${formatDate(profile.joinedAt)}`}
      />

      {profile.bio ? (
        // The same renderer and typography as a project description, so a
        // heading an author writes becomes a real heading and their bio is
        // prose rather than a lead-in paragraph.
        <div className="markdown-body mt-6 max-w-prose">
          <Markdown>{profile.bio}</Markdown>
        </div>
      ) : null}

      <section aria-labelledby="profile-projects-heading" className="mt-12">
        <h2
          id="profile-projects-heading"
          className="text-foreground text-lg font-semibold"
        >
          Projects
        </h2>

        {profile.projects.length === 0 ? (
          <EmptyState
            variant="inline"
            title="No public projects yet"
            description="Projects appear here once they are published."
          />
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {profile.projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export const Route = createFileRoute("/u/$username")({
  loader: async ({ params }): Promise<PublicProfile> => {
    const profile = await getPublicProfile({
      data: { username: params.username },
    });
    // A real 404 rather than a "not found" page rendered with a 200: this URL
    // is linked from every project byline, so a soft 404 would be indexed as
    // a page that exists.
    if (!profile) {
      throw notFound();
    }
    return profile;
  },
  head: ({ loaderData }) => {
    const bio = loaderData?.bio;
    return {
      meta: [
        { title: `${loaderData?.displayUsername ?? "Profile"} | VoxelVein` },
        // Markdown stripped to plain text, because a meta description is text
        // and rendering it would put tags in the search result.
        ...(bio ? [{ name: "description", content: toPreview(bio, 160) }] : []),
      ],
    };
  },
  component: ProfileRoute,
  pendingComponent: ProfileSkeleton,
});
