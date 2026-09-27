import { IconDownload, IconTag } from "@tabler/icons-react";

import { ProjectLink } from "@/components/projects/project-link";
import { formatCount } from "@/lib/format";
import type { ProjectDocument } from "@/lib/projects";

const ProjectCard = ({ project }: { project: ProjectDocument }) => (
  <article className="group border-border bg-card hover:border-border/80 focus-within:border-foreground/20 focus-within:ring-ring relative flex h-full flex-col rounded-xl border p-5 shadow-xs transition-[color,box-shadow,transform] duration-200 focus-within:ring-1 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none">
    {/* Full card focus overlay matching card corner radius */}
    <ProjectLink
      type={project.type}
      slug={project.slug}
      className="focus-visible:ring-ring absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="sr-only">View {project.name}</span>
    </ProjectLink>

    {/* Header */}
    <div className="flex items-start gap-3.5">
      <div className="border-primary/20 bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl border text-base font-bold shadow-inner">
        {project.name.charAt(0)}
      </div>

      <div className="min-w-0 flex-1">
        <span className="border-primary/20 bg-primary/10 text-primary inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
          {project.category}
        </span>

        <h3 className="text-foreground mt-1 truncate text-base font-semibold transition-colors duration-200">
          {project.name}
        </h3>

        <p className="text-muted-foreground truncate text-xs">
          by{" "}
          <span className="text-foreground/80 font-medium">
            {project.author}
          </span>
        </p>
      </div>
    </div>

    {/* Description */}
    <p className="text-muted-foreground mt-3.5 line-clamp-2 flex-1 text-sm leading-relaxed">
      {project.description}
    </p>

    {/* Footer Metadata */}
    <div className="border-border/60 text-muted-foreground mt-4 flex items-center justify-between gap-3 border-t pt-3.5 text-xs">
      <div className="flex items-center gap-3.5">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <IconDownload
            size={14}
            className="text-muted-foreground/70"
            aria-hidden="true"
          />
          {formatCount(project.downloads)}
        </span>

        <span className="inline-flex items-center gap-1.5 font-medium">
          <IconTag
            size={14}
            className="text-muted-foreground/70"
            aria-hidden="true"
          />
          {project.version}
        </span>
      </div>

      {project.gameVersions?.[0] && (
        <span className="border-border/50 bg-muted/60 text-muted-foreground max-w-[110px] truncate rounded border px-1.5 py-0.5 font-mono text-xs font-medium">
          {project.gameVersions[0]}
        </span>
      )}
    </div>
  </article>
);

export { ProjectCard };
