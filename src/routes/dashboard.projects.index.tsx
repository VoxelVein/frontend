import { IconPackage, IconPlus } from "@tabler/icons-react";
import {
  createFileRoute,
  Link,
  useLoaderData,
  useRouteContext,
} from "@tanstack/react-router";

import { ProjectSummaryCard } from "@/components/dashboard/project-summary-card";
import { VerificationNotice } from "@/components/dashboard/verification-notice";
import { EmptyState } from "@/components/empty-state";
import { Reveal } from "@/components/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyProjects } from "@/lib/projects.functions";
import { can } from "@/lib/roles";
import { cn } from "@/lib/utils";

const ROUTE_ID = "/dashboard/projects/";

/**
 * Section rhythm and measure follow the landing page: the same `py-16` band
 * and the same `max-w-7xl` inner column the explore grid uses, so moving
 * between the site and the creator dashboard does not feel like leaving it.
 */
const PAGE_SHELL = "px-4 py-16 sm:px-6 lg:px-8";

/** The project list while `listMyProjects` is in flight. */
const MyProjectsSkeleton = () => (
  <div aria-busy="true" className={PAGE_SHELL}>
    <div className="mx-auto max-w-7xl">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="mt-4 h-6 w-80 max-w-full" />
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-64 rounded-lg" />
        ))}
      </div>
    </div>
  </div>
);

const NewProjectLink = () => (
  <Link
    to="/dashboard/projects/new"
    className={cn(
      "min-h-12 rounded-lg px-6 text-base",
      "bg-primary text-primary-foreground hover:bg-primary/80",
      "focus-visible:ring-ring inline-flex items-center gap-2 font-medium",
      "transition-colors focus-visible:ring-3 focus-visible:outline-none"
    )}
  >
    <IconPlus size={18} aria-hidden="true" />
    New project
  </Link>
);

const MyProjectsPage = () => {
  const projects = useLoaderData({ from: ROUTE_ID });
  const { session } = useRouteContext({ from: ROUTE_ID });
  const canUpload =
    session.user.emailVerified || can(session.user.role, "reviewProjects");

  return (
    <div className={PAGE_SHELL}>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            {/* Sized and weighted like the landing page's section headings
                rather than the smaller PageHeader used across settings. */}
            <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
              My projects
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
              Everything you have published, and everything still in progress.
            </p>
          </div>
          {canUpload ? <NewProjectLink /> : null}
        </div>

        {canUpload ? null : (
          <div className="mt-8">
            <VerificationNotice />
          </div>
        )}

        {projects.length === 0 ? (
          <div className="mt-14">
            <EmptyState
              icon={<IconPackage size={24} aria-hidden="true" />}
              title="No projects yet"
              description="Create your first project to share it with the community."
            />
          </div>
        ) : (
          <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, index) => (
              <li className="h-full" key={project.id}>
                {/* Staggered like the explore tiles, so the grid arrives
                    rather than appearing all at once. */}
                <Reveal className="h-full" delay={Math.min(index, 5) * 0.06}>
                  <ProjectSummaryCard project={project} />
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/projects/")({
  pendingComponent: MyProjectsSkeleton,
  loader: () => listMyProjects(),
  head: () => ({ meta: [{ title: "My projects | VoxelVein" }] }),
  component: MyProjectsPage,
});
