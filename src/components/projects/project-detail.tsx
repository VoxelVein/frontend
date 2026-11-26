import { IconShieldCheck } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { MarkdownBody } from "@/components/markdown-body";
import { PageHeader } from "@/components/page-header";
import {
  ProjectDetailColumns,
  ProjectDetailHero,
  ProjectDetailPageFrame,
} from "@/components/projects/project-detail-layout";
import { ProjectDisclosuresSection } from "@/components/projects/project-disclosures";
import { ProjectGallery } from "@/components/projects/project-gallery";
import {
  ProjectDownloadPanel,
  ProjectVersionHistory,
} from "@/components/projects/project-versions";
import { ProjectReviews } from "@/components/reviews/project-reviews";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { errorMessage } from "@/lib/form-errors";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPE_PATHS,
} from "@/lib/projects";
import type { ProjectType, ProjectView } from "@/lib/projects";
import { setProjectProtected } from "@/lib/projects.functions";
import { can } from "@/lib/roles";

export { ProjectDetailSkeleton } from "@/components/projects/project-detail-layout";

export const ProjectNotFound = ({ type }: { type: ProjectType }) => (
  <ProjectDetailPageFrame>
    <PageHeader
      title={`${PROJECT_TYPE_LABELS[type].singular} not found`}
      description={`The ${PROJECT_TYPE_LABELS[type].singular.toLowerCase()} you are looking for does not exist or may have been removed.`}
      action={
        <Button render={<Link to={PROJECT_TYPE_PATHS[type]} />}>
          Browse {PROJECT_TYPE_LABELS[type].plural.toLowerCase()}
        </Button>
      }
    />
  </ProjectDetailPageFrame>
);

const ProtectionControl = ({
  isProtected,
  isSaving,
  onToggle,
}: {
  isProtected: boolean;
  isSaving: boolean;
  onToggle: () => void;
}) => (
  <section
    aria-labelledby="moderation-heading"
    className="border-border bg-card mt-5 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
  >
    <div>
      <h2
        id="moderation-heading"
        className="text-foreground text-sm font-semibold"
      >
        Admin moderation
      </h2>
      <p id="protection-help" className="text-muted-foreground mt-1 text-sm">
        Keep this project when its owner deletes their account.
      </p>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        className="min-h-10"
        aria-describedby="protection-help"
        disabled={isSaving}
        onClick={onToggle}
      >
        <IconShieldCheck size={16} aria-hidden="true" />
        {isProtected
          ? "Stop protecting this project"
          : "Protect from owner deletion"}
      </Button>
    </div>
  </section>
);

interface ProtectedOverride {
  isProtected: boolean;
  projectId: string;
}

/** Shared detail page for mods, modpacks, plugins, packs, shaders, and datapacks. */
export const ProjectDetail = ({ project }: { project: ProjectView }) => {
  const { data: session } = authClient.useSession();

  const canManage =
    session?.user.id === project.ownerId ||
    can(session?.user.role, "reviewProjects");

  const canProtect = can(session?.user.role, "manageProtectedProjects");

  const [protectedOverride, setProtectedOverride] =
    useState<ProtectedOverride | null>(null);

  const [isSavingProtection, setIsSavingProtection] = useState(false);

  const isProtected =
    protectedOverride?.projectId === project.id
      ? protectedOverride.isProtected
      : project.isProtected;

  const toggleProtected = async () => {
    const next = !isProtected;
    setIsSavingProtection(true);

    try {
      await setProjectProtected({
        data: { isProtected: next, projectId: project.id },
      });
      setProtectedOverride({ isProtected: next, projectId: project.id });
    } catch (error) {
      toast.error(errorMessage(error, "Could not update the project."));
    }

    setIsSavingProtection(false);
  };

  const singular = PROJECT_TYPE_LABELS[project.type].singular.toLowerCase();

  return (
    <ProjectDetailPageFrame>
      {project.status === "published" ? null : (
        <output className="border-primary/20 bg-primary/5 text-foreground mb-4 block rounded-lg border px-4 py-3 text-sm">
          This project is {PROJECT_STATUS_LABELS[project.status].toLowerCase()}.
          Only you and admins can view it.
        </output>
      )}

      {canProtect && project.pendingDeletion ? (
        <output className="border-border bg-muted text-foreground mb-4 block rounded-lg border px-4 py-3 text-sm">
          Scheduled for deletion when its owner&apos;s account is.
        </output>
      ) : null}

      <ProjectDetailHero
        canManage={canManage}
        isProtected={canProtect && isProtected}
        project={project}
        session={session}
      />

      {canProtect ? (
        <ProtectionControl
          isProtected={isProtected}
          isSaving={isSavingProtection}
          onToggle={() => toggleProtected()}
        />
      ) : null}

      <ProjectDetailColumns
        sidebar={<ProjectDownloadPanel project={project} />}
      >
        {project.description ? (
          <section
            aria-labelledby="project-about-heading"
            className="border-border bg-card rounded-xl border p-5 sm:p-7"
          >
            <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
              Project overview
            </p>
            <h2
              className="text-foreground mt-2 text-xl font-semibold tracking-tight sm:text-2xl"
              id="project-about-heading"
            >
              About this {singular}
            </h2>
            <div className="markdown-body mt-5">
              <MarkdownBody>{project.description}</MarkdownBody>
            </div>
          </section>
        ) : null}

        {project.status === "published" ? (
          <ProjectReviews ownerId={project.ownerId} projectId={project.id} />
        ) : null}

        {project.disclosures.length > 0 ? (
          <ProjectDisclosuresSection disclosures={project.disclosures} />
        ) : null}

        <ProjectGallery
          images={project.gallery}
          projectName={project.name}
          slug={project.slug}
          type={project.type}
        />

        <ProjectVersionHistory project={project} />

        {project.tags.length > 0 ? (
          <section
            aria-labelledby="project-tags-heading"
            className="border-border bg-card rounded-xl border p-5 sm:p-6"
          >
            <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
              Discovery
            </p>
            <h2
              className="text-foreground mt-2 text-lg font-semibold"
              id="project-tags-heading"
            >
              Explore related tags
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <li key={tag}>
                  <span className="border-border bg-background text-muted-foreground inline-flex min-h-8 items-center rounded-md border px-3 text-sm">
                    {tag}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </ProjectDetailColumns>
    </ProjectDetailPageFrame>
  );
};
