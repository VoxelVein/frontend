import { IconArrowRight, IconFlame } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { EmptyState } from "@/components/empty-state";
import { ProjectCard } from "@/components/projects/project-card";
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
          <ol
            aria-label="Trending projects"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          >
            {projects.map((project) => (
              <li key={project.id}>
                <ProjectCard project={project} />
              </li>
            ))}
          </ol>
        )}
      </Reveal>
    </section>
  );
};

export { TrendingProjects };
