import { IconPencil, IconShieldCheck } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { MarkdownBody } from "@/components/markdown-body";
import { ProjectBackLink } from "@/components/projects/project-back-link";
import { ProjectGallery } from "@/components/projects/project-gallery";
import { ProjectImage } from "@/components/projects/project-image";
import {
  ProjectDownloadPanel,
  ProjectVersionHistory,
} from "@/components/projects/project-versions";
import { ReportDialog } from "@/components/reports/report-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { errorMessage } from "@/lib/form-errors";
import { formatCategory, formatDate } from "@/lib/format";
import { PROJECT_TYPE_LABELS, PROTECTED_PROJECT_LABEL } from "@/lib/projects";
import type { ProjectType, ProjectView } from "@/lib/projects";
import { setProjectProtected } from "@/lib/projects.functions";
import { can } from "@/lib/roles";

const badgeClassName =
  "border-border bg-muted text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium";

export const ProjectNotFound = ({ type }: { type: ProjectType }) => (
  <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
    <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
      {PROJECT_TYPE_LABELS[type].singular} not found
    </h1>
    <p className="text-muted-foreground mt-2 text-sm">
      The {PROJECT_TYPE_LABELS[type].singular.toLowerCase()} you are looking for
      does not exist or may have been removed.
    </p>
    <div className="mt-6">
      <ProjectBackLink type={type} />
    </div>
  </div>
);

export const ProjectDetailSkeleton = () => (
  <div
    aria-busy="true"
    className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8"
  >
    <Skeleton className="h-11 w-36" />
    <div className="mt-4 flex gap-4 sm:gap-5">
      <Skeleton className="size-16 rounded-2xl sm:size-20" />
      <div className="flex-1">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-3 h-9 w-64 max-w-full" />
      </div>
    </div>

    <div className="mt-10 grid gap-10 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-12">
      <div className="grid gap-4">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
      <div>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-4 h-40 w-full rounded-xl" />
      </div>
    </div>
  </div>
);

interface ProtectionControlProps {
  isProtected: boolean;
  isSaving: boolean;
  saveError: string | null;
  onToggle: () => void;
}

const ProtectionControl = ({
  isProtected,
  isSaving,
  saveError,
  onToggle,
}: ProtectionControlProps) => (
  <section
    aria-labelledby="moderation-heading"
    className="border-border bg-card mt-4 rounded-xl border p-4"
  >
    <h2
      id="moderation-heading"
      className="text-foreground text-sm font-semibold"
    >
      Admin moderation
    </h2>
    <p id="protection-help" className="text-muted-foreground mt-1 text-sm">
      A protected project is kept when its owner deletes their account.
    </p>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        aria-describedby="protection-help"
        disabled={isSaving}
        onClick={onToggle}
      >
        <IconShieldCheck size={16} aria-hidden="true" />
        {isProtected
          ? "Stop protecting this project"
          : "Protect from owner deletion"}
      </Button>
      {saveError ? (
        <p role="alert" className="text-destructive text-sm">
          {saveError}
        </p>
      ) : null}
    </div>
  </section>
);

/**
 * The protected flag as the admin last saved it. Kept per project so that
 * navigating to another project falls back to that project's loaded value.
 */
interface ProtectedOverride {
  isProtected: boolean;
  projectId: string;
}

/**
 * Icon, category, name, author, report control.
 *
 * Split out of `ProjectDetail` because that component crossed the complexity
 * limit, but the boundary earns itself: the header holds every
 * permission-dependent branch on the page, and the rest reads as plain layout
 * once it is somewhere else.
 */
const ProjectHeader = ({
  canProtect,
  isProtected,
  project,
  session,
}: {
  canProtect: boolean;
  isProtected: boolean;
  project: ProjectView;
  session: { user: { id: string } } | null | undefined;
}) => {
  const singular = PROJECT_TYPE_LABELS[project.type].singular.toLowerCase();

  return (
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
          <span className="text-primary/80 border-primary/20 bg-primary/5 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase">
            {formatCategory(project.category)}
          </span>
          {canProtect && isProtected ? (
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
            // The only route to an author's profile, so it is a real link
            // rather than a name that looks clickable.
            <Link
              className="text-foreground hover:text-primary focus-visible:ring-ring focus-visible:ring-ring/50 rounded-sm underline-offset-2 transition-colors duration-150 hover:underline focus-visible:ring-3 focus-visible:outline-none"
              params={{ username: project.authorUsername }}
              to="/u/$username"
            >
              {project.author}
            </Link>
          ) : (
            // No account left behind the project, so there is no profile to
            // link to and the name stays plain text.
            project.author
          )}
          {" · "}
          <span>Updated {formatDate(project.updatedAt)}</span>
        </p>
      </div>

      {/* Placed in the header rather than buried in a menu: a member who can see
          something wrong should not have to go looking for the control. Hidden
          on a draft, which nobody else can see and so has nothing to report. */}
      {project.status === "published" ? (
        <ReportDialog
          projectId={project.id}
          targetKind="project"
          targetLabel={`this ${singular}`}
          unavailableReason={
            session?.user.id === project.ownerId
              ? "This is your project."
              : undefined
          }
        />
      ) : null}
    </header>
  );
};

/**
 * A downloadable project's public page.
 *
 * The same two-column shape as the server page, so all seven project pages read
 * as one design: a sidebar that answers "can I use this and how do I get it",
 * and the long-form content beside it. Both panels lead the DOM, which is what
 * makes the priority correct on mobile and for a screen reader alike.
 *
 * The sidebar exists because of where the download used to be. The versions
 * table was the last section on the page, under the description and the
 * gallery, so someone who came to install a mod had to read past everything
 * else before finding a file. It is still there — the full history is more than
 * one card can hold — but the newest version is now the first thing after the
 * summary.
 */
export const ProjectDetail = ({ project }: { project: ProjectView }) => {
  const { data: session } = authClient.useSession();
  // Staff can reach a project's dashboard to review it, so the link follows
  // the same bar as editing on the server.
  const canManage =
    session?.user.id === project.ownerId ||
    can(session?.user.role, "reviewProjects");
  // Marking a project large shields it from deletion with its owner's account,
  // so it is a separate capability from ordinary review.
  const canProtect = can(session?.user.role, "manageProtectedProjects");

  const [protectedOverride, setProtectedOverride] =
    useState<ProtectedOverride | null>(null);
  const [isSavingProtection, setIsSavingProtection] = useState(false);
  const [protectionError, setProtectionError] = useState<string | null>(null);

  const isProtected =
    protectedOverride?.projectId === project.id
      ? protectedOverride.isProtected
      : project.isProtected;

  const toggleProtected = async () => {
    const next = !isProtected;
    setIsSavingProtection(true);
    setProtectionError(null);
    try {
      await setProjectProtected({
        data: { isProtected: next, projectId: project.id },
      });
      setProtectedOverride({ isProtected: next, projectId: project.id });
    } catch (error) {
      setProtectionError(errorMessage(error, "Could not update the project."));
    }
    setIsSavingProtection(false);
  };

  const singular = PROJECT_TYPE_LABELS[project.type].singular.toLowerCase();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ProjectBackLink type={project.type} />
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

      {canProtect && project.pendingDeletion ? (
        <output className="border-border bg-muted text-foreground mt-4 block rounded-xl border px-4 py-3 text-sm">
          {/* Shown to an admin, not the owner, so this talks about "its owner"
            rather than "your account". */}
          Scheduled for deletion when its owner&apos;s account is.
        </output>
      ) : null}

      {canProtect ? (
        <ProtectionControl
          isProtected={isProtected}
          isSaving={isSavingProtection}
          saveError={protectionError}
          onToggle={() => toggleProtected()}
        />
      ) : null}

      {project.status === "published" ? null : (
        <output className="border-border bg-muted text-foreground mt-4 block rounded-xl border px-4 py-3 text-sm">
          This {singular} is a draft. Only you and admins can see it.
        </output>
      )}

      <ProjectHeader
        canProtect={canProtect}
        isProtected={isProtected}
        project={project}
        session={session}
      />

      <p className="text-muted-foreground mt-6 max-w-prose text-base leading-7">
        {project.summary}
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-12">
        <ProjectDownloadPanel project={project} />

        <div className="min-w-0">
          {project.description ? (
            <section aria-labelledby="project-about-heading">
              <h2
                className="text-foreground text-lg font-semibold"
                id="project-about-heading"
              >
                About this {singular}
              </h2>
              <div className="markdown-body mt-3">
                <MarkdownBody>{project.description}</MarkdownBody>
              </div>
            </section>
          ) : null}

          <ProjectGallery
            images={project.gallery}
            projectName={project.name}
            slug={project.slug}
            type={project.type}
          />

          <div className={project.description ? "mt-10" : undefined}>
            <ProjectVersionHistory project={project} />
          </div>

          {project.tags.length > 0 ? (
            <section aria-labelledby="project-tags-heading" className="mt-10">
              <h2
                className="text-foreground text-lg font-semibold"
                id="project-tags-heading"
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
