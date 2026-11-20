import {
  IconDownload,
  IconEye,
  IconPackage,
  IconPencil,
  IconTrash,
  IconVersions,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import { ProjectImage } from "@/components/projects/project-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCategory, formatCount, formatDate } from "@/lib/format";
import {
  hasVersions,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPE_PATHS,
} from "@/lib/projects";
import type { ProjectListItem, ProjectStatus } from "@/lib/projects";
import { cn } from "@/lib/utils";

interface ProjectSummaryCardProps {
  onDelete: (project: ProjectListItem) => void;
  project: ProjectListItem;
}

const STATUS_VARIANT: Record<
  ProjectStatus,
  "default" | "outline" | "secondary" | "destructive"
> = {
  draft: "outline",
  pending: "secondary",
  published: "default",
  removed: "destructive",
};

const formatVersionCount = (count: number): string =>
  `${formatCount(count)} ${count === 1 ? "version" : "versions"}`;

/**
 * One project in the creator workspace.
 *
 * Laid out as a row rather than a tile: the overview is a management screen,
 * so the useful comparison is between projects  -  status, category, releases,
 * downloads, when it last changed  -  and actions sit at the end of that row
 * instead of below a description.
 */
export const ProjectSummaryCard = ({
  onDelete,
  project,
}: ProjectSummaryCardProps) => (
  <article className="group hover:bg-muted/20 flex flex-col gap-4 px-4 py-5 transition-colors sm:flex-row sm:items-center sm:gap-5 sm:px-5">
    <ProjectImage
      image={project.icon}
      alt=""
      ratio="square"
      className="size-14 shrink-0 rounded-xl border sm:size-16"
      fallback={
        <span
          aria-hidden="true"
          className="border-primary/15 bg-primary/10 text-primary flex size-14 shrink-0 items-center justify-center rounded-xl border sm:size-16"
        >
          <IconPackage size={24} stroke={1.8} />
        </span>
      }
    />

    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <h2 className="text-foreground min-w-0 truncate text-base font-semibold tracking-tight sm:text-lg">
          {project.name}
        </h2>
        <Badge variant={STATUS_VARIANT[project.status]}>
          {PROJECT_STATUS_LABELS[project.status]}
        </Badge>
        <span className="text-muted-foreground text-xs">
          {PROJECT_TYPE_LABELS[project.type].singular}
        </span>
      </div>

      <p className="text-muted-foreground mt-1 line-clamp-2 max-w-3xl text-sm leading-6">
        {project.summary}
      </p>

      <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="text-primary font-medium">
          {formatCategory(project.category)}
        </span>
        {hasVersions(project.type) ? (
          <span className="inline-flex items-center gap-1">
            <IconVersions aria-hidden="true" size={14} />
            {formatVersionCount(project.versionCount)}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <IconDownload aria-hidden="true" size={14} />
          {formatCount(project.downloads)} downloads
        </span>
        <span>Updated {formatDate(project.updatedAt)}</span>
      </div>
    </div>

    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
      <Button
        size="sm"
        className="min-h-10"
        render={
          <Link
            to="/dashboard/projects/$projectId"
            params={{ projectId: project.id }}
            preload="intent"
          />
        }
      >
        <IconPencil aria-hidden="true" />
        Manage
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="min-h-10"
        render={
          <Link
            to={`${PROJECT_TYPE_PATHS[project.type]}/$slug`}
            params={{ slug: project.slug }}
            preload="intent"
          />
        }
      >
        <IconEye aria-hidden="true" />
        {project.status === "published" ? "View" : "Preview"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={cn(
          "text-muted-foreground hover:bg-destructive/10 hover:text-destructive min-h-10"
        )}
        onClick={() => onDelete(project)}
        aria-label={`Delete ${project.name}`}
      >
        <IconTrash aria-hidden="true" />
        Delete
      </Button>
    </div>
  </article>
);
