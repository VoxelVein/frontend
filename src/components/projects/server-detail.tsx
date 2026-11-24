import { MarkdownBody } from "@/components/markdown-body";
import {
  ProjectDetailColumns,
  ProjectDetailHero,
  ProjectDetailPageFrame,
} from "@/components/projects/project-detail-layout";
import { ProjectDisclosuresSection } from "@/components/projects/project-disclosures";
import { ProjectGallery } from "@/components/projects/project-gallery";
import {
  ServerJoinPanel,
  ServerRequirements,
} from "@/components/projects/server-detail-panels";
import { ServerVoteButton } from "@/components/projects/server-vote-button";
import { authClient } from "@/lib/auth-client";
import type { ProjectView } from "@/lib/projects";
import { can } from "@/lib/roles";

/** Server details share the project page shell while keeping their join flow. */
const ServerDetail = ({ project }: { project: ProjectView }) => {
  const { data: session } = authClient.useSession();

  const canManage =
    session?.user.id === project.ownerId ||
    can(session?.user.role, "reviewProjects");

  return (
    <ProjectDetailPageFrame>
      {project.status === "published" ? null : (
        <output className="border-primary/20 bg-primary/5 text-foreground mb-4 block rounded-lg border px-4 py-3 text-sm">
          This server is{" "}
          {project.status === "draft" ? "a draft" : `still ${project.status}`}.
          Only you and admins can view this page.
        </output>
      )}

      <ProjectDetailHero
        canManage={canManage}
        isProtected={project.isProtected}
        project={project}
        session={session}
      />

      <ProjectDetailColumns
        sidebar={
          <div className="grid gap-4">
            <ServerJoinPanel server={project.server} />
            <ServerVoteButton projectId={project.id} />
          </div>
        }
      >
        <section
          aria-labelledby="server-description-heading"
          className="border-border bg-card rounded-xl border p-5 sm:p-7"
        >
          <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
            Server overview
          </p>
          <h2
            className="text-foreground mt-2 text-xl font-semibold tracking-tight sm:text-2xl"
            id="server-description-heading"
          >
            About this server
          </h2>
          {project.description ? (
            <div className="markdown-body mt-5">
              <MarkdownBody>{project.description}</MarkdownBody>
            </div>
          ) : (
            <p className="text-muted-foreground mt-4 text-sm leading-6">
              The owner has not added a description yet.
            </p>
          )}
        </section>

        {project.server ? (
          <section
            aria-labelledby="server-requirements-heading"
            className="border-border bg-card rounded-xl border p-5 sm:p-7"
          >
            <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
              Server setup
            </p>
            <h2
              className="text-foreground mt-2 text-xl font-semibold tracking-tight sm:text-2xl"
              id="server-requirements-heading"
            >
              What you need to join
            </h2>
            <div className="mt-5">
              <ServerRequirements server={project.server} />
            </div>
          </section>
        ) : null}

        {project.disclosures.length > 0 ? (
          <ProjectDisclosuresSection disclosures={project.disclosures} />
        ) : null}

        <ProjectGallery
          images={project.gallery}
          projectName={project.name}
          slug={project.slug}
          type="server"
        />

        {project.tags.length > 0 ? (
          <section
            aria-labelledby="server-tags-heading"
            className="border-border bg-card rounded-xl border p-5 sm:p-6"
          >
            <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
              Discovery
            </p>
            <h2
              className="text-foreground mt-2 text-lg font-semibold"
              id="server-tags-heading"
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

export { ServerDetail };
