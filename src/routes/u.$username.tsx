import { IconDownload, IconPackage } from "@tabler/icons-react";
import {
  createFileRoute,
  Link,
  notFound,
  useLoaderData,
} from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { MarkdownBody } from "@/components/markdown-body";
import { ProjectCard } from "@/components/projects/project-card";
import { StatCard } from "@/components/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount, formatDate } from "@/lib/format";
import { toPreview } from "@/lib/posts";
import { PROJECT_TYPE_LABELS, PROJECT_TYPE_PATHS } from "@/lib/projects";
import type { ProjectDocument, ProjectType } from "@/lib/projects";
import { getPublicProfile } from "@/lib/user-profiles.functions";
import type { PublicProfile } from "@/lib/user-profiles.functions";
import { cn } from "@/lib/utils";

/** A profile with no projects still renders; only the grid is replaced. */
const ProfileSkeleton = () => (
  <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14">
    <div className="border-border bg-card flex items-start gap-4 rounded-2xl border p-6 sm:gap-5">
      <Skeleton className="size-16 shrink-0 rounded-2xl sm:size-20" />
      <div className="flex-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      </div>
    </div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:max-w-md">
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
    <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  </div>
);

/**
 * The account's avatar, or their initial in a letter tile.
 *
 * Same tile treatment as a project's icon on its detail page — same size, same
 * radius, same fallback colours — so a profile and the projects under it read as
 * one set of surfaces.
 */
const ProfileAvatar = ({
  image,
  name,
}: {
  image: string | null;
  name: string;
}) => {
  if (image) {
    return (
      <img
        alt=""
        className="border-border size-16 shrink-0 rounded-2xl border object-cover sm:size-20"
        decoding="async"
        height={80}
        loading="eager"
        src={image}
        width={80}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="border-border bg-primary/10 text-primary flex size-16 shrink-0 items-center justify-center rounded-2xl border text-2xl font-bold sm:size-20 sm:text-3xl"
    >
      {name.charAt(0)}
    </div>
  );
};

/**
 * One filter chip per type the creator has published in.
 *
 * Only types actually present get a chip, so a single-type creator is not shown
 * a filter with one option. Clicking a chip narrows the grid; clicking it again
 * clears the filter.
 */
const TypeFilter = ({
  counts,
  onSelect,
  selected,
  typeCounts,
}: {
  counts: Record<ProjectType, number>;
  onSelect: (type: ProjectType | null) => void;
  selected: ProjectType | null;
  typeCounts: Partial<Record<ProjectType, number>>;
}) => {
  // SAFETY: `typeCounts` is keyed by `ProjectType`, so `Object.keys` returns
  // exactly that union and nothing else.
  const present = Object.keys(typeCounts) as ProjectType[];

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      {present.map((type) => (
        <button
          key={type}
          type="button"
          aria-pressed={selected === type}
          onClick={() => {
            onSelect(selected === type ? null : type);
          }}
          className={cn(
            "focus-visible:ring-ring focus-visible:ring-ring/50 inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none",
            selected === type
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          {PROJECT_TYPE_LABELS[type].plural}
          <span
            className={cn("tabular-nums", selected === type && "opacity-80")}
          >
            {counts[type]}
          </span>
        </button>
      ))}
    </div>
  );
};

const ProfileRoute = () => {
  const profile = useLoaderData({ from: "/u/$username" });
  const [selectedType, setSelectedType] = useState<ProjectType | null>(null);

  const { counts, totalDownloads, typeCounts, visible } = useMemo(() => {
    const nextCounts = {
      mod: 0,
      modpack: 0,
      plugin: 0,
      resourcepack: 0,
      server: 0,
      shader: 0,
    } satisfies Record<ProjectType, number>;
    const nextTypeCounts: Partial<Record<ProjectType, number>> = {};

    let downloads = 0;
    for (const project of profile.projects) {
      nextCounts[project.type] += 1;
      nextTypeCounts[project.type] = (nextTypeCounts[project.type] ?? 0) + 1;
      downloads += project.downloads;
    }

    return {
      counts: nextCounts,
      totalDownloads: downloads,
      typeCounts: nextTypeCounts,
      visible:
        selectedType === null
          ? profile.projects
          : profile.projects.filter((project) => project.type === selectedType),
    };
  }, [profile.projects, selectedType]);

  // The heading, the handle, and the real name are three different strings in
  // general. Printing all three unconditionally reads as a mistake when two of
  // them are the same text, so each is dropped when it adds nothing.
  const handle = `@${profile.username}`;
  const showsHandle = handle !== `@${profile.displayUsername.toLowerCase()}`;
  const showsName =
    profile.name !== profile.displayUsername &&
    profile.name !== profile.username;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14">
      {/* The identity card reuses the project's header treatment — avatar tile
          beside the title — so a profile and the projects it lists are visibly
          the same kind of thing. */}
      <div className="border-border bg-card rounded-2xl border p-6">
        <div className="flex items-start gap-4 sm:gap-5">
          <ProfileAvatar image={profile.image} name={profile.displayUsername} />

          <div className="min-w-0">
            <h1 className="text-foreground text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              {profile.displayUsername}
            </h1>

            <p className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {showsHandle ? (
                <>
                  <span className="font-medium">{handle}</span>
                  <span aria-hidden="true">·</span>
                </>
              ) : null}
              {showsName ? (
                <>
                  <span>{profile.name}</span>
                  <span aria-hidden="true">·</span>
                </>
              ) : null}
              <span>Joined {formatDate(profile.joinedAt)}</span>
            </p>
          </div>
        </div>

        {profile.bio ? (
          // The same renderer and typography as a project description, so a
          // heading an author writes becomes a real heading and their bio is
          // prose rather than a lead-in paragraph.
          <div className="markdown-body border-border mt-6 max-w-prose border-t pt-6">
            <MarkdownBody>{profile.bio}</MarkdownBody>
          </div>
        ) : null}
      </div>

      {/* Totals are summed from the projects already on the page rather than
          fetched separately, so the two can never disagree. */}
      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:max-w-md">
        <StatCard
          icon={<IconPackage size={16} aria-hidden="true" />}
          label={profile.projects.length === 1 ? "Project" : "Projects"}
          value={formatCount(profile.projects.length)}
        />
        <StatCard
          icon={<IconDownload size={16} aria-hidden="true" />}
          label="Downloads"
          value={formatCount(totalDownloads)}
        />
      </dl>

      {Object.keys(typeCounts).length > 1 ? (
        <TypeFilter
          counts={counts}
          onSelect={setSelectedType}
          selected={selectedType}
          typeCounts={typeCounts}
        />
      ) : null}

      <section aria-labelledby="profile-projects-heading" className="mt-12">
        <h2
          id="profile-projects-heading"
          className="text-foreground text-lg font-semibold"
        >
          {selectedType === null
            ? "Projects"
            : PROJECT_TYPE_LABELS[selectedType].plural}
        </h2>

        {visible.length === 0 ? (
          <EmptyState
            variant="inline"
            icon={<IconPackage size={20} aria-hidden="true" />}
            title={`No ${
              selectedType === null
                ? "public projects"
                : PROJECT_TYPE_LABELS[selectedType].plural.toLowerCase()
            } yet`}
            description={
              selectedType === null
                ? "Projects appear here once they are published."
                : `Browse every ${PROJECT_TYPE_LABELS[
                    selectedType
                  ].plural.toLowerCase()} on VoxelVein.`
            }
            action={
              selectedType === null ? null : (
                // A `Link`, not an `<a>`: this is an internal route, and a raw
                // anchor forces a full document load.
                <Link
                  className="text-primary focus-visible:ring-ring focus-visible:ring-ring/50 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:underline focus-visible:ring-3 focus-visible:outline-none"
                  to={PROJECT_TYPE_PATHS[selectedType]}
                >
                  Browse{" "}
                  {PROJECT_TYPE_LABELS[selectedType].plural.toLowerCase()}
                </Link>
              )
            }
          />
        ) : (
          <ul
            aria-label="Projects"
            className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {visible.map((project: ProjectDocument) => (
              <li key={project.id}>
                <ProjectCard project={project} />
              </li>
            ))}
          </ul>
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
