import {
  IconCalendar,
  IconDownload,
  IconPencil,
  IconShieldCheck,
  IconTag,
  IconVersions,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { MarkdownBody } from "@/components/markdown-body";
import { ProjectBackLink } from "@/components/projects/project-back-link";
import { ProjectGallery } from "@/components/projects/project-gallery";
import { ProjectImage } from "@/components/projects/project-image";
import { ReportDialog } from "@/components/reports/report-dialog";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { errorMessage } from "@/lib/form-errors";
import {
  formatBytes,
  formatCategory,
  formatCount,
  formatDate,
} from "@/lib/format";
import { PROJECT_TYPE_LABELS, PROTECTED_PROJECT_LABEL } from "@/lib/projects";
import type {
  ProjectType,
  ProjectVersionView,
  ProjectView,
} from "@/lib/projects";
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
    className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8"
  >
    <Skeleton className="h-11 w-36" />
    <div className="mt-4 flex gap-4">
      <Skeleton className="size-16 rounded-2xl sm:size-20" />
      <div className="flex-1">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-3 h-9 w-64 max-w-full" />
      </div>
    </div>
    <Skeleton className="mt-8 h-24 w-full rounded-xl" />
    <Skeleton className="mt-8 h-48 w-full rounded-xl" />
  </div>
);

const VersionsTable = ({ versions }: { versions: ProjectVersionView[] }) => {
  if (versions.length === 0) {
    return (
      <EmptyState
        description="No downloads available yet. This project is still being set up — check back soon."
        icon={<IconVersions size={24} aria-hidden="true" />}
        title="No versions yet"
        variant="inline"
      />
    );
  }

  return (
    <div className="border-border mt-3 overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Versions, newest first, with their downloadable files
        </caption>
        <thead className="bg-muted/50 text-muted-foreground text-xs tracking-wide uppercase">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Version
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Compatibility
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Released
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Files
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {versions.map((version) => (
            <tr key={version.id} className="align-top">
              <th scope="row" className="px-4 py-3 font-medium">
                <span className="text-foreground block">
                  {version.versionNumber}
                </span>
                <span className="text-muted-foreground block text-xs font-normal capitalize">
                  {version.channel}
                </span>
              </th>
              <td className="text-muted-foreground px-4 py-3">
                <span className="block capitalize">
                  {version.loaders.join(", ")}
                </span>
                <span className="block text-xs">
                  {version.gameVersions.join(", ")}
                </span>
              </td>
              <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                {formatDate(version.createdAt)}
              </td>
              <td className="px-4 py-3">
                <ul className="flex flex-col gap-2">
                  {version.files.map((file) => (
                    <li key={file.id}>
                      <a
                        href={`/api/download/${file.id}`}
                        className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <IconDownload size={16} aria-hidden="true" />
                        <span>
                          Download{" "}
                          <span className="sr-only">{file.filename}</span>
                        </span>
                      </a>
                      <span className="text-muted-foreground block text-xs break-all">
                        {file.filename} · {formatBytes(file.size)}
                      </span>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ProjectStats = ({ project }: { project: ProjectView }) => {
  const [latest] = project.versions;
  return (
    <dl className="mt-8 grid gap-4 sm:grid-cols-3">
      <StatCard
        icon={<IconDownload size={16} aria-hidden="true" />}
        label="Downloads"
        value={formatCount(project.downloads)}
      />
      <StatCard
        icon={<IconTag size={16} aria-hidden="true" />}
        label="Latest version"
        value={latest?.versionNumber ?? "None yet"}
      />
      <StatCard
        icon={<IconCalendar size={16} aria-hidden="true" />}
        label="Updated"
        value={formatDate(project.updatedAt)}
      />
    </dl>
  );
};

/**
 * The versions table.
 *
 * Only for the downloadable types. A server has no files and no versions, so it
 * renders `ServerDetail` instead of this page, which is why there is no
 * `isServer` branch here any more — the old one produced a stats row and a
 * heading for a page whose whole subject is an address.
 */
const ProjectVersions = ({ project }: { project: ProjectView }) => (
  <section aria-labelledby="versions-heading" className="mt-10">
    <h2 id="versions-heading" className="text-foreground text-lg font-semibold">
      Versions
    </h2>
    <VersionsTable versions={project.versions} />
  </section>
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ProjectBackLink type={project.type} />
        {canManage ? (
          <Link
            to="/dashboard/projects/$projectId"
            params={{ projectId: project.id }}
            className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            <IconPencil size={16} aria-hidden="true" />
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
          This {PROJECT_TYPE_LABELS[project.type].singular.toLowerCase()} is a
          draft. Only you and admins can see it.
        </output>
      )}

      <header className="mt-4 flex items-start gap-4 sm:gap-5">
        <ProjectImage
          image={project.icon}
          alt=""
          priority
          className="border-border size-16 shrink-0 rounded-2xl border sm:size-20"
          fallback={
            <div
              aria-hidden="true"
              className="border-border bg-primary/10 text-primary flex size-16 shrink-0 items-center justify-center rounded-2xl border text-2xl font-bold sm:size-20 sm:text-3xl"
            >
              {project.name.charAt(0)}
            </div>
          }
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-primary/80 border-primary/20 bg-primary/5 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase">
              {formatCategory(project.category)}
            </span>
            {canProtect && isProtected ? (
              <span className={`${badgeClassName} gap-1`}>
                <IconShieldCheck size={12} aria-hidden="true" />
                {PROTECTED_PROJECT_LABEL}
              </span>
            ) : null}
          </div>
          <h1 className="text-foreground mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {project.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            by{" "}
            {project.authorUsername ? (
              // The only route to an author's profile, so it is a real link
              // rather than a name that looks clickable.
              <Link
                to="/u/$username"
                params={{ username: project.authorUsername }}
                className="text-foreground hover:text-primary focus-visible:ring-ring focus-visible:ring-ring/50 rounded-sm underline-offset-2 transition-colors duration-150 hover:underline focus-visible:ring-3 focus-visible:outline-none"
              >
                {project.author}
              </Link>
            ) : (
              // No account left behind the project, so there is no profile to
              // link to and the name stays plain text.
              project.author
            )}
          </p>
        </div>

        {/* Placed in the header rather than buried in a menu: a member who can
            see something wrong should not have to go looking for the control.
            Hidden on a draft, because an unpublished project is visible only to
            its owner and staff, and there is nothing for another member to
            report. */}
        {project.status === "published" ? (
          <ReportDialog
            projectId={project.id}
            targetKind="project"
            targetLabel={`this ${PROJECT_TYPE_LABELS[project.type].singular.toLowerCase()}`}
            unavailableReason={
              session?.user.id === project.ownerId
                ? "This is your project."
                : undefined
            }
          />
        ) : null}
      </header>

      <p className="text-muted-foreground mt-6 text-base leading-7">
        {project.summary}
      </p>

      <ProjectStats project={project} />

      {project.description ? (
        <section aria-labelledby="description-heading" className="mt-10">
          <h2
            id="description-heading"
            className="text-foreground text-lg font-semibold"
          >
            Description
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

      <ProjectVersions project={project} />

      {project.tags.length > 0 ? (
        <section aria-labelledby="tags-heading" className="mt-10">
          <h2
            id="tags-heading"
            className="text-foreground text-lg font-semibold"
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
  );
};
