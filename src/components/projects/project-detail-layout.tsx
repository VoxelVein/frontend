import {
  IconArrowLeft,
  IconClock,
  IconDownload,
  IconPhoto,
  IconShieldCheck,
  IconVersions,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { ProjectBackLink } from "@/components/projects/project-back-link";
import { ProjectImage } from "@/components/projects/project-image";
import { ServerPlayerCount } from "@/components/projects/server-player-count";
import { ReportDialog } from "@/components/reports/report-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isSafeAvatarSrc } from "@/lib/avatar-url";
import { formatCategory, formatCount, formatDate } from "@/lib/format";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_PATHS,
  PROJECT_TYPE_LABELS,
  PROTECTED_PROJECT_LABEL,
} from "@/lib/projects";
import type { ProjectView } from "@/lib/projects";

const DetailStat = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) => (
  <span className="inline-flex min-w-0 items-center gap-2 text-sm">
    <span className="text-muted-foreground flex items-center">{icon}</span>
    <span className="text-foreground font-semibold tabular-nums">{value}</span>
    <span className="text-muted-foreground">{label}</span>
  </span>
);

/**
 * Who published this, and when it last changed.
 *
 * The picture is only rendered when the owner actually has one. Every other
 * avatar surface falls back to an initial tile, but in a byline that reads as
 * a picture the account never chose  -  an account without a profile picture
 * shows its name alone here.
 */
const ProjectByline = ({ project }: { project: ProjectView }) => {
  const hasAvatar =
    project.authorImage !== null && isSafeAvatarSrc(project.authorImage);

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>Created by</span>
      {hasAvatar ? (
        <Avatar image={project.authorImage} name={project.author} size="xs" />
      ) : null}
      {project.authorUsername ? (
        <Link
          className="text-foreground decoration-border hover:text-primary focus-visible:ring-ring rounded-sm underline underline-offset-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          params={{ username: project.authorUsername }}
          to="/u/$username"
        >
          {project.author}
        </Link>
      ) : (
        <span className="text-foreground">{project.author}</span>
      )}
      <span aria-hidden="true">·</span>
      <span>Updated {formatDate(project.updatedAt)}</span>
    </span>
  );
};

/** Shared identity and navigation for every project type's detail page. */
export const ProjectDetailHero = ({
  canManage,
  isProtected,
  project,
  session,
}: {
  canManage: boolean;
  isProtected: boolean;
  project: ProjectView;
  session: { user: { id: string } } | null | undefined;
}) => {
  const typeLabel = PROJECT_TYPE_LABELS[project.type].singular;
  const statusLabel = PROJECT_STATUS_LABELS[project.status];

  return (
    <>
      <nav
        aria-label="Project navigation"
        className="flex min-h-11 flex-wrap items-center justify-between gap-2"
      >
        <ProjectBackLink type={project.type} />
        {canManage ? (
          <Button
            variant="outline"
            size="sm"
            className="min-h-10"
            render={
              <Link
                params={{ projectId: project.id }}
                to="/dashboard/projects/$projectId"
              />
            }
          >
            Manage project
          </Button>
        ) : null}
      </nav>

      <div className="mt-6">
        <PageHeader
          title={project.name}
          description={
            <span className="block">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-foreground font-medium">{typeLabel}</span>
                <span aria-hidden="true" className="text-border">
                  /
                </span>
                <span className="border-primary/25 bg-primary/10 text-primary inline-flex min-h-6 items-center rounded-md border px-2 text-xs font-semibold">
                  {formatCategory(project.category)}
                </span>
                <span className="border-border bg-muted text-muted-foreground inline-flex min-h-6 items-center rounded-md border px-2 text-xs font-medium">
                  {statusLabel}
                </span>
                {isProtected ? (
                  <span className="border-border bg-muted text-muted-foreground inline-flex min-h-6 items-center gap-1 rounded-md border px-2 text-xs font-medium">
                    <IconShieldCheck aria-hidden="true" size={13} />
                    {PROTECTED_PROJECT_LABEL}
                  </span>
                ) : null}
              </span>
              <span className="mt-2 block">
                <ProjectByline project={project} />
              </span>
            </span>
          }
          icon={
            <ProjectImage
              alt={`${project.name} logo`}
              className="border-border bg-background size-16 rounded-xl border sm:size-20"
              fallbackSeed={project.id}
              image={project.icon}
              priority
            />
          }
          action={
            project.status === "published" ? (
              <ReportDialog
                projectId={project.id}
                targetKind="project"
                targetLabel={`this ${typeLabel.toLowerCase()}`}
                unavailableReason={
                  session?.user.id === project.ownerId
                    ? `This is your ${typeLabel.toLowerCase()}.`
                    : undefined
                }
              />
            ) : undefined
          }
        />

        <p className="text-muted-foreground mt-4 max-w-2xl text-sm leading-6 sm:text-base sm:leading-7">
          {project.summary}
        </p>

        <div className="border-border mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-4">
          {project.type === "server" ? (
            <>
              <DetailStat
                icon={<IconVersions aria-hidden="true" size={16} />}
                label="game versions"
                value={String(project.server?.gameVersions.length ?? 0)}
              />
              <ServerPlayerCount projectId={project.id} />
              <DetailStat
                icon={<IconPhoto aria-hidden="true" size={16} />}
                label="screenshots"
                value={String(project.gallery.length)}
              />
            </>
          ) : (
            <>
              <DetailStat
                icon={<IconDownload aria-hidden="true" size={16} />}
                label="downloads"
                value={formatCount(project.downloads)}
              />
              <DetailStat
                icon={<IconVersions aria-hidden="true" size={16} />}
                label="releases"
                value={String(project.versions.length)}
              />
              <DetailStat
                icon={<IconClock aria-hidden="true" size={16} />}
                label="last updated"
                value={formatDate(project.updatedAt)}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
};

/** Sidebar first for mobile download/join access, two columns on wide screens. */
export const ProjectDetailColumns = ({
  children,
  sidebar,
}: {
  children: ReactNode;
  sidebar: ReactNode;
}) => (
  <div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
    <aside className="min-w-0 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
      {sidebar}
    </aside>
    <div className="grid min-w-0 content-start gap-7 lg:col-start-1 lg:row-start-1 lg:gap-9">
      {children}
    </div>
  </div>
);

/** Consistent page width and responsive gutters for project details and galleries. */
export const ProjectDetailPageFrame = ({
  children,
}: {
  children: ReactNode;
}) => (
  <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
    {children}
  </div>
);

export const ProjectDetailSkeleton = () => (
  <div
    aria-busy="true"
    className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
  >
    <Skeleton className="h-11 w-32" />
    <div className="mt-6 flex items-start gap-4">
      <Skeleton className="size-16 rounded-xl sm:size-20" />
      <div className="grid content-start gap-3">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-5 w-64 max-w-full" />
      </div>
    </div>
    <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
    <div className="mt-5 flex gap-6 border-t pt-4">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-5 w-32" />
    </div>
    <div className="mt-8 grid gap-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
      <div className="grid gap-5">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  </div>
);

export const ProjectGalleryBackLink = ({
  projectName,
  slug,
  type,
}: {
  projectName: string;
  slug: string;
  type: ProjectView["type"];
}) => (
  <Link
    to={`${PROJECT_TYPE_PATHS[type]}/$slug`}
    params={{ slug }}
    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
  >
    <IconArrowLeft aria-hidden="true" size={16} />
    Back to {projectName}
  </Link>
);
