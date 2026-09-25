import { IconPackage, IconPlus } from "@tabler/icons-react";
import {
  createFileRoute,
  Link,
  useLoaderData,
  useRouteContext,
} from "@tanstack/react-router";

import { VerificationNotice } from "@/components/dashboard/verification-notice";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { formatCount, formatDate } from "@/lib/format";
import { PROJECT_TYPE_LABELS } from "@/lib/projects";
import { listMyProjects } from "@/lib/projects.functions";

const ROUTE_ID = "/dashboard/projects/";

const STATUS_LABELS = {
  draft: "Draft",
  published: "Published",
  removed: "Removed",
} as const;

const NewProjectLink = () => (
  <Button
    render={<Link to="/dashboard/projects/new" />}
    nativeButton={false}
    className="min-h-11"
  >
    <IconPlus size={16} aria-hidden="true" />
    New project
  </Button>
);

const MyProjectsPage = () => {
  const projects = useLoaderData({ from: ROUTE_ID });
  const { session } = useRouteContext({ from: ROUTE_ID });
  const canUpload = session.user.emailVerified || session.user.role === "admin";

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="My projects"
          description="Create and manage the mods and plugins you publish."
        />
        {canUpload ? <NewProjectLink /> : null}
      </div>

      {canUpload ? null : <VerificationNotice />}

      {projects.length === 0 ? (
        <EmptyState
          icon={<IconPackage size={24} aria-hidden="true" />}
          title="No projects yet"
          description="Create your first mod or plugin to share it with the community."
        />
      ) : (
        <ul className="mt-8 grid gap-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                to="/dashboard/projects/$projectId"
                params={{ projectId: project.id }}
                className="border-border bg-card hover:bg-muted/50 focus-visible:ring-ring flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="min-w-0">
                  <span className="text-foreground block truncate font-semibold">
                    {project.name}
                  </span>
                  <span className="text-muted-foreground block text-sm">
                    {PROJECT_TYPE_LABELS[project.type].singular} ·{" "}
                    {STATUS_LABELS[project.status]} · {project.versionCount}{" "}
                    {project.versionCount === 1 ? "version" : "versions"}
                  </span>
                </span>
                <span className="text-muted-foreground text-sm">
                  {formatCount(project.downloads)} downloads · Updated{" "}
                  {formatDate(project.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const Route = createFileRoute("/dashboard/projects/")({
  loader: () => listMyProjects(),
  head: () => ({ meta: [{ title: "My projects — VoxelVein" }] }),
  component: MyProjectsPage,
});
