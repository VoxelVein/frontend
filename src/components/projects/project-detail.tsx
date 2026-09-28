import {
  IconArrowLeft,
  IconCalendar,
  IconCopy,
  IconPackages,
  IconDownload,
  IconPencil,
  IconShieldCheck,
  IconTag,
  IconVersions,
  IconWorld,
} from "@tabler/icons-react";
import { Markdown } from "@tanstack/markdown/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { ProjectLink } from "@/components/projects/project-link";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { MICRO_LABEL_CLASS } from "@/lib/classes";
import { errorMessage } from "@/lib/form-errors";
import { formatBytes, formatCount, formatDate } from "@/lib/format";
import {
  formatServerAddress,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPE_PATHS,
} from "@/lib/projects";
import type {
  ProjectServerView,
  ProjectType,
  ProjectVersionView,
  ProjectView,
} from "@/lib/projects";
import { setProjectProtected } from "@/lib/projects.functions";

const badgeClassName =
  "border-border bg-muted text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium";

const BackLink = ({ type }: { type: ProjectType }) => (
  <Link
    to={PROJECT_TYPE_PATHS[type]}
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
      <EmptyState
        description="Nothing is downloadable on this page yet. Published projects always have at least one version, so this is a transient state."
        icon={<IconVersions size={24} aria-hidden="true" />}
        title="No versions have been uploaded yet"
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

const COPIED_RESET_MS = 2000;

const ServerClientContent = ({ server }: { server: ProjectServerView }) => {
  if (server.links.length === 0) {
    return (
      <div>
        <h3 className="text-foreground text-sm font-semibold">
          Client content
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Vanilla client: join without installing anything.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-foreground text-sm font-semibold">Client content</h3>
      <p className="text-muted-foreground mt-1 text-sm">
        {server.clientRequirement === "required"
          ? "Install the required content below to join."
          : "Nothing is required to join; these are recommended."}
      </p>
      <ul className="mt-3 grid gap-2">
        {server.links.map((link) => (
          <li
            key={link.id}
            className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <IconPackages
                size={20}
                aria-hidden="true"
                className="text-muted-foreground shrink-0"
              />
              <div className="min-w-0">
                <p className="text-foreground font-medium">{link.name}</p>
                <p className="text-muted-foreground text-sm">
                  {PROJECT_TYPE_LABELS[link.type].singular} ·{" "}
                  {link.required ? "Required" : "Recommended"}
                </p>
              </div>
            </div>
            <ProjectLink
              type={link.type}
              slug={link.slug}
              className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              View {PROJECT_TYPE_LABELS[link.type].singular.toLowerCase()}
              <span className="sr-only"> {link.name}</span>
            </ProjectLink>
          </li>
        ))}
      </ul>
    </div>
  );
};

const ServerJoin = ({ server }: { server: ProjectServerView | null }) => {
  const [copyStatus, setCopyStatus] = useState("");

  if (!server) {
    return (
      <p className="text-muted-foreground mt-3 text-sm">
        The owner has not added the server address yet.
      </p>
    );
  }

  const address = formatServerAddress(server.address, server.port);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopyStatus("Address copied.");
    } catch {
      setCopyStatus("Could not copy. Select the address and copy it.");
    }
    setTimeout(() => setCopyStatus(""), COPIED_RESET_MS);
  };

  return (
    <div className="mt-3 grid gap-4">
      <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <div className="min-w-0">
          <p className={MICRO_LABEL_CLASS}>Server address</p>
          <p className="text-foreground mt-1 font-mono text-lg break-all select-all">
            {address}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => copy()}
        >
          <IconCopy size={16} aria-hidden="true" />
          Copy address
        </Button>
        <p
          aria-live="polite"
          className="text-muted-foreground w-full text-sm empty:hidden"
        >
          {copyStatus}
        </p>
      </div>

      <div>
        <h3 className="text-foreground text-sm font-semibold">
          Supported versions
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          {server.gameVersions.join(", ")}
        </p>
      </div>

      <ServerClientContent server={server} />
    </div>
  );
};

const ProjectStats = ({ project }: { project: ProjectView }) => {
  const [latest] = project.versions;
  const isServer = project.type === "server";
  return (
    <dl className="mt-8 grid gap-4 sm:grid-cols-3">
      {isServer ? (
        <StatCard
          label="Supported versions"
          icon={<IconWorld size={16} aria-hidden="true" />}
          value={formatCount(project.server?.gameVersions.length ?? 0)}
        />
      ) : (
        <StatCard
          label="Downloads"
          icon={<IconDownload size={16} aria-hidden="true" />}
          value={formatCount(project.downloads)}
        />
      )}
      {isServer ? (
        <StatCard
          label="Latest supported"
          icon={<IconTag size={16} aria-hidden="true" />}
          value={project.server?.gameVersions[0] ?? "None yet"}
        />
      ) : (
        <StatCard
          label="Latest version"
          icon={<IconTag size={16} aria-hidden="true" />}
          value={latest?.versionNumber ?? "None yet"}
        />
      )}
      <StatCard
        label="Updated"
        icon={<IconCalendar size={16} aria-hidden="true" />}
        value={formatDate(project.updatedAt)}
      />
    </dl>
  );
};

/** Versions table for downloadable types, join details for servers. */
const ProjectDownloads = ({ project }: { project: ProjectView }) => {
  if (project.type === "server") {
    return (
      <section aria-labelledby="join-heading" className="mt-10">
        <h2 id="join-heading" className="text-foreground text-lg font-semibold">
          Join
        </h2>
        <ServerJoin server={project.server} />
      </section>
    );
  }
  return (
    <section aria-labelledby="versions-heading" className="mt-10">
      <h2
        id="versions-heading"
        className="text-foreground text-lg font-semibold"
      >
        Versions
      </h2>
      <VersionsTable versions={project.versions} />
    </section>
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
            by{" "}
            {project.authorUsername ? (
              // The only route to an author's profile, so it is a real link
              // rather than a name that looks clickable.
              <Link
                to="/u/$username"
                params={{ username: project.authorUsername }}
                className="text-foreground hover:text-primary focus-visible:ring-ring focus-visible:ring-ring/50 rounded-sm underline-offset-2 hover:underline focus-visible:ring-3 focus-visible:outline-none"
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
            <Markdown>{project.description}</Markdown>
          </div>
        </section>
      ) : null}

      <ProjectDownloads project={project} />

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
