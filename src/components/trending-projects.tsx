import { IconArrowRight, IconFlame } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";

import { EmptyState } from "@/components/empty-state";
import { TrendingProjectCard } from "@/components/projects/trending-project-card";
import { Reveal } from "@/components/reveal";
import { buttonVariants } from "@/components/ui/button-variants";
import type { ProjectDocument } from "@/lib/projects";
import {
  getTrendingProjects,
  TRENDING_REFRESH_MS,
} from "@/lib/trending.functions";
import { cn } from "@/lib/utils";

interface TrendingProjectsProps {
  /** Server-rendered list, so the section never flashes empty. */
  initialProjects: ProjectDocument[];
}

/**
 * One column per project, so a short list never leaves holes.
 *
 * A fixed column count would leave four empty cells beside a single project.
 * Dividing by the actual count instead means one project fills the row, two
 * split it, five fill it — and every card is the same width, which is what
 * makes the row read as a ranking rather than an arbitrary slice of a grid.
 *
 * The count goes in a custom property rather than an inline `grid-template-columns`
 * so the responsive class below still wins at the breakpoints: an inline style
 * outranks any class, which would pin five cards across a phone.
 *
 * `minmax(0, 1fr)` rather than plain `1fr`: grid tracks default to
 * `minmax(auto, 1fr)`, and an `auto` minimum lets a long project name push its
 * column wider than its share, which would break the equal widths.
 */
/**
 * The custom property carrying the column count.
 *
 * React's `CSSProperties` does not know about custom properties, so the
 * widening is asserted rather than worked around.
 */
const columnCount = (count: number) =>
  // SAFETY: the object literal holds exactly one custom property, which React
  // forwards to the element verbatim; `CSSProperties` simply has no index
  // signature for them.
  ({ "--trending-cols": count }) as CSSProperties;

const TrendingGrid = ({ projects }: { projects: ProjectDocument[] }) => (
  <ol
    aria-label="Trending projects"
    className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(var(--trending-cols),minmax(0,1fr))]"
    style={columnCount(projects.length)}
  >
    {projects.map((project, index) => (
      <li key={project.id}>
        <TrendingProjectCard project={project} rank={index + 1} />
      </li>
    ))}
  </ol>
);

const TrendingProjects = ({ initialProjects }: TrendingProjectsProps) => {
  const { data: projects = initialProjects } = useQuery({
    initialData: initialProjects,
    queryFn: () => getTrendingProjects(),
    queryKey: ["trending-projects"],
    refetchInterval: TRENDING_REFRESH_MS,
    staleTime: TRENDING_REFRESH_MS,
  });

  return (
    <section
      aria-labelledby="trending-heading"
      className="px-4 py-12 sm:px-6 sm:py-14 lg:px-8"
      id="trending"
    >
      {/* One reveal for the whole section, so the heading and the cards
          arrive together instead of the heading leading on its own. */}
      <Reveal className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground mb-2 inline-flex items-center gap-1.5 text-sm font-medium">
              <IconFlame aria-hidden size={16} />
              Popular right now
            </p>

            <h2
              className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl"
              id="trending-heading"
            >
              Trending projects
            </h2>

            <p className="text-muted-foreground mt-2 max-w-prose text-sm sm:text-base">
              Popular projects with recent releases, updated every minute.
            </p>
          </div>

          <Link
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "hidden min-h-12 shrink-0 sm:inline-flex"
            )}
            preload="intent"
            to="/mods"
          >
            <span>Browse all</span>
            <IconArrowRight aria-hidden size={18} />
          </Link>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            action={
              <Link
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "min-h-11"
                )}
                to="/mods"
              >
                Browse mods
              </Link>
            }
            description="Once projects are published, the most popular ones show up here."
            icon={<IconFlame aria-hidden size={24} />}
            title="Nothing trending yet"
            variant="inline"
          />
        ) : (
          <TrendingGrid projects={projects} />
        )}
      </Reveal>
    </section>
  );
};

export { TrendingProjects };
