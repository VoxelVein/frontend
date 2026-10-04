import { IconPencil, IconShieldCheck } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/empty-state";
import { MarkdownBody } from "@/components/markdown-body";
import { ProjectBackLink } from "@/components/projects/project-back-link";
import { ProjectGallery } from "@/components/projects/project-gallery";
import { ProjectImage } from "@/components/projects/project-image";
import { ServerJoinPanel } from "@/components/projects/server-detail-panels";
import { ReportDialog } from "@/components/reports/report-dialog";
import { authClient } from "@/lib/auth-client";
import { formatCategory, formatDate } from "@/lib/format";
import { PROTECTED_PROJECT_LABEL } from "@/lib/projects";
import type { ProjectView } from "@/lib/projects";
import { can } from "@/lib/roles";

const badgeClassName =
  "border-border bg-muted text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium";

/**
 * A server's public page.
 *
 * Deliberately not a variant of `ProjectDetail`. Every other type is a
 * download, so that page is organised around a versions table; a server has no
 * files and its whole purpose is an address, an address's supported versions,
 * and what to install before joining. Fitting that into the download layout
 * meant the address sat in a "Join" section below the stats, the summary, and
 * the description — last on the screen, for the only thing the visitor came for.
 *
 * So the page is a sidebar: the join panel on the left at `lg` and up, because
 * it is the answer to "can I play here"; the description, gallery, and tags on
 * the right, because those are context for a decision the panel has already
 * settled. Below `lg` it is one column with the panel first, which is the same
 * priority order reading top to bottom gives you.
 */
const ServerDetail = ({ project }: { project: ProjectView }) => {
  const { data: session } = authClient.useSession();
  const canManage =
    session?.user.id === project.ownerId ||
    can(session?.user.role, "reviewProjects");

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ProjectBackLink type="server" />
        {canManage ? (
          <Link
            className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
            params={{ projectId: project.id }}
            to="/dashboard/projects/$projectId"
          >
            <IconPencil aria-hidden="true" size={16} />
            Manage
          </Link>
        ) : null}
      </div>

      {project.status === "published" ? null : (
        <output className="border-border bg-muted text-foreground mt-4 block rounded-xl border px-4 py-3 text-sm">
          This server is a draft. Only you and admins can see it.
        </output>
      )}

      <header className="mt-4 flex items-start gap-4 sm:gap-5">
        <ProjectImage
          alt=""
          className="border-border size-16 shrink-0 rounded-2xl border sm:size-20"
          fallback={
            <div
              aria-hidden="true"
              className="border-border bg-primary/10 text-primary flex size-16 shrink-0 items-center justify-center rounded-2xl border text-2xl font-bold sm:size-20 sm:text-3xl"
            >
              {project.name.charAt(0)}
            </div>
          }
          image={project.icon}
          priority
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* The gamemode. On a server page this is the first thing a player
                filters by, so it gets the accent pill the download page gives
                a project's category. */}
            <span className="text-primary/80 border-primary/20 bg-primary/5 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase">
              {formatCategory(project.category)}
            </span>
            {project.isProtected ? (
              <span className={`${badgeClassName} gap-1`}>
                <IconShieldCheck aria-hidden="true" size={12} />
                {PROTECTED_PROJECT_LABEL}
              </span>
            ) : null}
          </div>

          <h1 className="text-foreground mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {project.name}
          </h1>

          <p className="text-muted-foreground mt-1 text-sm">
            by{" "}
            {project.authorUsername ? (
              <Link
                className="text-foreground hover:text-primary focus-visible:ring-ring focus-visible:ring-ring/50 rounded-sm underline-offset-2 transition-colors duration-150 hover:underline focus-visible:ring-3 focus-visible:outline-none"
                params={{ username: project.authorUsername }}
                to="/u/$username"
              >
                {project.author}
              </Link>
            ) : (
              project.author
            )}
            {" · "}
            <span>Updated {formatDate(project.updatedAt)}</span>
          </p>
        </div>

        {/* In the header rather than a menu: someone who can see something wrong
            should not have to go looking for the control. Hidden on a draft,
            which nobody else can see. */}
        {project.status === "published" ? (
          <ReportDialog
            projectId={project.id}
            targetKind="project"
            targetLabel="this server"
            unavailableReason={
              session?.user.id === project.ownerId
                ? "This is your server."
                : undefined
            }
          />
        ) : null}
      </header>

      <p className="text-muted-foreground mt-6 max-w-prose text-base leading-7">
        {project.summary}
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-12">
        <ServerJoinPanel server={project.server} />

        <div className="min-w-0">
          {project.description ? (
            <section aria-labelledby="server-description-heading">
              <h2
                className="text-foreground text-lg font-semibold"
                id="server-description-heading"
              >
                About this server
              </h2>
              <div className="markdown-body mt-3">
                <MarkdownBody>{project.description}</MarkdownBody>
              </div>
            </section>
          ) : (
            <EmptyState
              description="The owner has not written a description for this server yet."
              title="Nothing here yet"
              variant="inline"
            />
          )}

          <ProjectGallery
            images={project.gallery}
            projectName={project.name}
            slug={project.slug}
            type="server"
          />

          {project.tags.length > 0 ? (
            <section aria-labelledby="server-tags-heading" className="mt-10">
              <h2
                className="text-foreground text-lg font-semibold"
                id="server-tags-heading"
              >
                Tags
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <li key={tag}>
                    <span className={badgeClassName}>{tag}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export { ServerDetail };
