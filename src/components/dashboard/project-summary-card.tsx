import { IconPackage } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import { FilledPill } from "@/components/filled-pill";
import { ProjectImage } from "@/components/projects/project-image";
import { formatCount, formatDate } from "@/lib/format";
import {
  hasVersions,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from "@/lib/projects";
import type { ProjectListItem } from "@/lib/projects";
import { cn } from "@/lib/utils";

const formatVersionCount = (count: number): string =>
  `${formatCount(count)} ${count === 1 ? "version" : "versions"}`;

/**
 * One project in the creator's list.
 *
 * Built from the landing page's category tile rather than a settings row: the
 * same border, the same hover lift, the same icon well, and the status in the
 * filled accent pill. A creator dashboard that looks like the settings screen
 * reads as a different product from the site they publish to.
 */
export const ProjectSummaryCard = ({
  project,
}: {
  project: ProjectListItem;
}) => (
  <article
    className={cn(
      "border-border ease-smooth group bg-card relative flex h-full flex-col rounded-lg border p-6",
      "hover:border-foreground/20 transition-transform duration-300 hover:-translate-y-0.5",
      "focus-within:border-foreground/20 focus-within:-translate-y-0.5",
      "motion-reduce:transform-none motion-reduce:transition-none"
    )}
  >
    {/* The whole card is one link. It sits above the text so the
        non-interactive content never steals the pointer, while staying a real
        link for keyboard and screen reader users. */}
    <Link
      to="/dashboard/projects/$projectId"
      params={{ projectId: project.id }}
      preload="intent"
      className="focus-visible:ring-ring absolute inset-0 z-10 rounded-lg focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="sr-only">Manage {project.name}</span>
    </Link>

    <div className="flex items-start justify-between gap-3">
      <ProjectImage
        image={project.icon}
        alt=""
        ratio="square"
        className="size-12 shrink-0 rounded-xl"
        fallback={
          <span
            aria-hidden="true"
            className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl"
          >
            <IconPackage size={22} stroke={1.8} />
          </span>
        }
      />
      <FilledPill className="text-xs">
        {PROJECT_STATUS_LABELS[project.status]}
      </FilledPill>
    </div>

    <h3 className="mt-5 mb-1 text-lg font-semibold tracking-tight">
      {project.name}
    </h3>

    <p className="text-muted-foreground text-sm leading-6">
      {PROJECT_TYPE_LABELS[project.type].singular}
      {hasVersions(project.type)
        ? ` · ${formatVersionCount(project.versionCount)}`
        : null}
      {` · ${formatCount(project.downloads)} downloads`}
    </p>

    {/* `mt-auto` pins the footer to the bottom so the cards line up across
        the row regardless of name length. */}
    <p className="text-muted-foreground mt-6 flex min-h-11 items-center border-t pt-4 text-sm">
      Updated {formatDate(project.updatedAt)}
    </p>
  </article>
);
