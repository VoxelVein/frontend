import { IconDownload, IconTag } from "@tabler/icons-react";

import { ProjectLink } from "@/components/projects/project-link";
import { formatCount } from "@/lib/format";
import type { ProjectDocument } from "@/lib/projects";

const ProjectCard = ({ project }: { project: ProjectDocument }) => (
  <article className="group border-border bg-card focus-within:border-foreground/20 relative flex h-full flex-col rounded-2xl border p-5 transition-colors duration-300 focus-within:ring-1 motion-reduce:transition-none">
    <ProjectLink
      type={project.type}
      slug={project.slug}
      className="focus-visible:ring-ring absolute inset-0 z-10 rounded-2xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="sr-only">View {project.name}</span>
    </ProjectLink>

    <div className="flex items-start gap-4">
      <div className="border-border bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl border text-lg font-bold">
        {project.name.charAt(0)}
      </div>

      <div className="min-w-0 pt-0.5">
        <span className="text-primary/80 border-primary/20 bg-primary/5 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium tracking-wide uppercase">
          {project.category}
        </span>

        <h3 className="text-foreground mt-2 truncate text-base font-semibold">
          {project.name}
        </h3>

        <p className="text-muted-foreground truncate text-xs">
          by {project.author}
        </p>
      </div>
    </div>

    <p className="text-muted-foreground mt-3 line-clamp-2 text-sm leading-6">
      {project.description}
    </p>

    <div className="text-muted-foreground mt-auto flex items-center justify-between gap-4 pt-4 text-xs">
      <div className="flex items-center gap-4">
        <span className="inline-flex items-center gap-1.5">
          <IconDownload size={14} aria-hidden="true" />
          {formatCount(project.downloads)}
        </span>

        <span className="inline-flex items-center gap-1.5">
          <IconTag size={14} aria-hidden="true" />
          {project.version}
        </span>
      </div>

      <span className="truncate">{project.gameVersions[0] ?? ""}</span>
    </div>
  </article>
);

export { ProjectCard };
