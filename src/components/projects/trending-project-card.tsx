import { IconDownload, IconTag } from "@tabler/icons-react";

import { ProjectImage } from "@/components/projects/project-image";
import { ProjectLink } from "@/components/projects/project-link";
import { formatCount } from "@/lib/format";
import type { ProjectDocument } from "@/lib/projects";

interface TrendingProjectCardProps {
  project: ProjectDocument;
  /** 1-based position in the trending list. */
  rank: number;
}

/**
 * A card for the landing page's trending row.
 *
 * Deliberately separate from `ProjectCard`, which the browse grid and profile
 * pages use. Those two have room to show a gallery image and a tag list; this
 * row can be five cards across, so everything here is chosen for reading at
 * roughly 230px wide.
 *
 * Flat by design — a border and `bg-card` do the separating, with no shadow
 * and no lift on hover, matching the news lead card above it.
 */
const TrendingProjectCard = ({ project, rank }: TrendingProjectCardProps) => (
  <article className="group border-border bg-card focus-within:border-foreground/30 hover:border-foreground/30 relative flex h-full flex-col rounded-2xl border p-5 transition-colors duration-200 motion-reduce:transition-none">
    {/* The whole card is the target, but it stays a real link so it is
        reachable by keyboard and announced with the project it leads to. */}
    <ProjectLink
      type={project.type}
      slug={project.slug}
      className="focus-visible:ring-ring focus-visible:ring-ring/50 absolute inset-0 z-10 rounded-2xl focus-visible:ring-3 focus-visible:outline-none"
    >
      <span className="sr-only">View {project.name}</span>
    </ProjectLink>

    <div className="flex items-start gap-3">
      <ProjectImage
        image={project.icon}
        alt=""
        className="size-11 shrink-0 rounded-xl border"
        fallback={
          <div className="border-primary/20 bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl border text-base font-bold">
            {project.name.charAt(0)}
          </div>
        }
      />

      <div className="min-w-0 flex-1">
        {/* The position is part of what "trending" means, so it is named
            rather than left to the list order alone. */}
        <span className="text-muted-foreground text-xs font-medium">
          #{rank}
        </span>
        {/* An explicit size, not an inherited one: the row sits inside a
            section that does not set one, so leaving it off ties the card title
            to whatever the body size happens to be. */}
        <h3 className="text-foreground mt-0.5 truncate text-base font-semibold tracking-tight">
          {project.name}
        </h3>
        <p className="text-muted-foreground truncate text-xs">
          {project.author}
        </p>
      </div>
    </div>

    <p className="text-muted-foreground mt-3.5 line-clamp-2 flex-1 text-sm leading-relaxed">
      {project.description}
    </p>

    <div className="border-border/60 text-muted-foreground mt-4 flex items-center justify-between gap-3 border-t pt-3.5 text-xs">
      <span className="inline-flex items-center gap-1.5 font-medium">
        <IconDownload
          aria-hidden="true"
          className="text-muted-foreground/70"
          size={14}
        />
        {formatCount(project.downloads)}
      </span>

      {project.gameVersions?.[0] ? (
        <span className="inline-flex min-w-0 items-center gap-1.5 font-medium">
          <IconTag
            aria-hidden="true"
            className="text-muted-foreground/70 shrink-0"
            size={14}
          />
          <span className="truncate">{project.gameVersions[0]}</span>
        </span>
      ) : null}
    </div>
  </article>
);

export { TrendingProjectCard };
