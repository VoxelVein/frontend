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

import { ProjectBackLink } from "@/components/projects/project-back-link";
import { ProjectImage } from "@/components/projects/project-image";
import { ServerPlayerCount } from "@/components/projects/server-player-count";
import { ReportDialog } from "@/components/reports/report-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCategory, formatCount, formatDate } from "@/lib/format";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_PATHS,
  PROJECT_TYPE_LABELS,
  PROTECTED_PROJECT_LABEL,
} from "@/lib/projects";
import type { ProjectView } from "@/lib/projects";

const eyebrowClass =
  "text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-[0.16em] uppercase";

const DetailStat = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex min-w-0 items-center gap-2.5">
    <span className="bg-background/70 text-primary border-border/70 flex size-9 shrink-0 items-center justify-center rounded-lg border">
      {icon}
    </span>
    <span className="min-w-0">
      <span className="text-foreground block truncate text-sm font-semibold tabular-nums">
        {value}
      </span>
      <span className="text-muted-foreground block text-xs">{label}</span>
    </span>
  </div>
);

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

      <header className="border-border bg-card relative isolate mt-5 overflow-hidden rounded-2xl border shadow-sm">
        <div
          aria-hidden="true"
          className="from-primary/15 via-card to-background absolute inset-0 bg-gradient-to-br"
        />
        {project.gallery[0] ? (
          <ProjectImage
            alt=""
            image={project.gallery[0]}
            priority
            ratio="square"
            className="absolute inset-0 size-full opacity-20 mix-blend-luminosity"
          />
        ) : null}
        <div
          aria-hidden="true"
          className="from-card/95 via-card/80 to-card/45 absolute inset-0 bg-gradient-to-r"
        />

        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-9">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end sm:gap-6">
            <ProjectImage
              alt={`${project.name} logo`}
              className="border-border bg-background size-20 shrink-0 rounded-2xl border shadow-lg sm:size-24"
              fallback={
                <div className="border-border bg-primary/10 text-primary flex size-20 shrink-0 items-center justify-center rounded-2xl border text-3xl font-bold shadow-lg sm:size-24">
                  {project.name.charAt(0)}
                </div>
              }
              image={project.icon}
              priority
            />

            <div className="min-w-0 pb-0.5">
              <p className={eyebrowClass}>
                <span className="text-primary">VoxelVein</span>
                <span aria-hidden="true">/</span>
                <span>{typeLabel}</span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="border-primary/25 bg-primary/10 text-primary inline-flex min-h-7 items-center rounded-md border px-2.5 text-xs font-semibold">
                  {formatCategory(project.category)}
                </span>
                <span className="border-border bg-background/70 text-muted-foreground inline-flex min-h-7 items-center rounded-md border px-2.5 text-xs font-medium">
                  {statusLabel}
                </span>
                {isProtected ? (
                  <span className="border-border bg-background/70 text-muted-foreground inline-flex min-h-7 items-center gap-1 rounded-md border px-2.5 text-xs font-medium">
                    <IconShieldCheck aria-hidden="true" size={13} />
                    {PROTECTED_PROJECT_LABEL}
                  </span>
                ) : null}
              </div>
              <h1 className="text-foreground mt-2 text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                {project.name}
              </h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Created by{" "}
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
                <span className="mx-2" aria-hidden="true">
                  ·
                </span>
                Updated {formatDate(project.updatedAt)}
              </p>
            </div>
          </div>

          {project.status === "published" ? (
            <div className="flex items-center justify-start lg:justify-end">
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
            </div>
          ) : null}

          <p className="text-foreground/85 max-w-3xl text-sm leading-6 sm:text-base sm:leading-7 lg:col-span-2">
            {project.summary}
          </p>

          <div className="border-border/80 grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-5 sm:grid-cols-3 sm:gap-6 lg:col-span-2 lg:max-w-3xl">
            {project.type === "server" ? (
              <>
                <DetailStat
                  icon={<IconVersions aria-hidden="true" size={17} />}
                  label="Game versions"
                  value={String(project.server?.gameVersions.length ?? 0)}
                />
                <ServerPlayerCount projectId={project.id} />
                <DetailStat
                  icon={<IconPhoto aria-hidden="true" size={17} />}
                  label="Screenshots"
                  value={String(project.gallery.length)}
                />
              </>
            ) : (
              <>
                <DetailStat
                  icon={<IconDownload aria-hidden="true" size={17} />}
                  label="Downloads"
                  value={formatCount(project.downloads)}
                />
                <DetailStat
                  icon={<IconVersions aria-hidden="true" size={17} />}
                  label="Releases"
                  value={String(project.versions.length)}
                />
                <DetailStat
                  icon={<IconClock aria-hidden="true" size={17} />}
                  label="Last updated"
                  value={formatDate(project.updatedAt)}
                />
              </>
            )}
          </div>
        </div>
      </header>
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
  <div className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
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
  <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
    {children}
  </div>
);

export const ProjectDetailSkeleton = () => (
  <div aria-busy="true">
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
      <Skeleton className="h-10 w-36" />
      <div className="border-border bg-card mt-5 grid min-h-80 gap-6 rounded-2xl border p-5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:p-8">
        <Skeleton className="size-20 rounded-2xl sm:size-24" />
        <div className="grid content-start gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-5 w-full max-w-xl" />
          <Skeleton className="mt-5 h-12 w-full max-w-2xl" />
        </div>
      </div>
      <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-5">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
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
