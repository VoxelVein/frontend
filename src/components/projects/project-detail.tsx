import {
  IconArrowLeft,
  IconCalendar,
  IconDownload,
  IconPencil,
  IconShieldCheck,
  IconTag,
} from "@tabler/icons-react";
import { Markdown } from "@tanstack/markdown/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { errorMessage } from "@/lib/form-errors";
import { formatBytes, formatCount, formatDate } from "@/lib/format";
import { PROJECT_TYPE_LABELS } from "@/lib/projects";
import type {
  ProjectType,
  ProjectVersionView,
  ProjectView,
} from "@/lib/projects";
import { setProjectProtected } from "@/lib/projects.functions";

const badgeClassName =
  "border-border bg-muted text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium";

const BackLink = ({ type }: { type: ProjectType }) => (
  <Link
    to={type === "mod" ? "/mods" : "/plugins"}
    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
  >
    <IconArrowLeft size={16} aria-hidden="true" />
    Back to {PROJECT_TYPE_LABELS[type].plural.toLowerCase()}
  </Link>
);

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
      <BackLink type={type} />
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
      <p className="text-muted-foreground mt-3 text-sm">
        No versions have been uploaded yet.
      </p>
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
              Published
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
      Large projects are never deleted with their owner&apos;s account.
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
        {isProtected ? "Unmark large project" : "Mark as large project"}
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
  const isAdmin = session?.user.role === "admin";
  const canManage = session?.user.id === project.ownerId || isAdmin;
  const [latest] = project.versions;
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
        <BackLink type={project.type} />
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

      {isAdmin && project.pendingDeletion ? (
        <output className="border-border bg-muted text-foreground mt-4 block rounded-xl border px-4 py-3 text-sm">
          Scheduled for deletion with its owner&apos;s account.
        </output>
      ) : null}

      {isAdmin ? (
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
        <div
          aria-hidden="true"
          className="border-border bg-primary/10 text-primary flex size-16 shrink-0 items-center justify-center rounded-2xl border text-2xl font-bold sm:size-20 sm:text-3xl"
        >
          {project.name.charAt(0)}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-primary/80 border-primary/20 bg-primary/5 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide uppercase">
              {project.category.replaceAll("-", " ")}
            </span>
            {isAdmin && isProtected ? (
              <span className={`${badgeClassName} gap-1`}>
                <IconShieldCheck size={12} aria-hidden="true" />
                Large project
              </span>
            ) : null}
          </div>
          <h1 className="text-foreground mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {project.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            by {project.author}
          </p>
        </div>
      </header>

      <p className="text-muted-foreground mt-6 text-base leading-7">
        {project.summary}
      </p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Downloads"
          icon={<IconDownload size={16} aria-hidden="true" />}
          value={formatCount(project.downloads)}
        />
        <StatCard
          label="Latest version"
          icon={<IconTag size={16} aria-hidden="true" />}
          value={latest?.versionNumber ?? "None yet"}
        />
        <StatCard
          label="Updated"
          icon={<IconCalendar size={16} aria-hidden="true" />}
          value={formatDate(project.updatedAt)}
        />
      </dl>

      {project.description ? (
        <section aria-labelledby="description-heading" className="mt-10">
          <h2
            id="description-heading"
            className="text-foreground text-lg font-semibold"
          >
            Description
          </h2>
          <div className="markdown-body mt-3">
            <Markdown>{project.description}</Markdown>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="versions-heading" className="mt-10">
        <h2
          id="versions-heading"
          className="text-foreground text-lg font-semibold"
        >
          Versions
        </h2>
        <VersionsTable versions={project.versions} />
      </section>

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
