import {
  IconArrowLeft,
  IconCheck,
  IconEye,
  IconPackage,
  IconUpload,
} from "@tabler/icons-react";
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { toast } from "sonner";

import { ProjectForm } from "@/components/dashboard/project-form";
import { VerificationNotice } from "@/components/dashboard/verification-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectInput } from "@/lib/projects";
import { createProject } from "@/lib/projects.functions";
import { can } from "@/lib/roles";

const NewProjectPage = () => {
  const { session } = useRouteContext({ from: "/dashboard/projects/new" });
  const navigate = useNavigate();

  const canUpload =
    session.user.emailVerified || can(session.user.role, "reviewProjects");

  const handleSubmit = async (input: ProjectInput) => {
    const { id } = await createProject({ data: input });
    toast.success("Project created. Add a version to prepare it for review.");
    await navigate({
      params: { projectId: id },
      search: { tab: "versions" },
      to: "/dashboard/projects/$projectId",
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Button
        variant="ghost"
        className="min-h-10 px-2"
        render={<Link to="/dashboard/projects" />}
      >
        <IconArrowLeft aria-hidden="true" />
        Back to projects
      </Button>

      <header className="mt-5 max-w-3xl">
        <Badge variant="outline">New draft</Badge>
        <h1 className="text-foreground mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Create a project
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6 sm:text-base">
          Set up the public identity for your project. You can add versions,
          files, and images after creating its draft.
        </p>
      </header>

      {canUpload ? (
        <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section
            aria-labelledby="project-form-heading"
            className="border-border bg-card rounded-2xl border p-4 sm:p-7"
          >
            <h2 className="sr-only" id="project-form-heading">
              Project details
            </h2>
            <ProjectForm
              mode="create"
              submitLabel="Create project"
              onSubmit={handleSubmit}
            />
          </section>

          <aside
            aria-labelledby="project-workflow-heading"
            className="border-border bg-card grid gap-5 rounded-2xl border p-5 xl:sticky xl:top-20"
          >
            <div>
              <p className="text-primary text-sm font-medium">Publishing</p>
              <h2
                className="text-foreground mt-2 text-lg font-semibold"
                id="project-workflow-heading"
              >
                From draft to release
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                New projects stay private while you prepare them. Nothing is
                visible on the site until it passes review.
              </p>
            </div>

            <ol className="grid gap-3">
              {[
                {
                  icon: <IconPackage aria-hidden="true" size={16} />,
                  label: "Create the project draft",
                },
                {
                  icon: <IconUpload aria-hidden="true" size={16} />,
                  label: "Upload a version and its file",
                },
                {
                  icon: <IconEye aria-hidden="true" size={16} />,
                  label: "Submit it for review",
                },
              ].map((step, index) => (
                <li key={step.label} className="flex items-start gap-3 text-sm">
                  <span className="border-border bg-background text-primary flex size-8 shrink-0 items-center justify-center rounded-lg border">
                    {step.icon}
                  </span>
                  <span className="text-muted-foreground pt-1.5">
                    <span className="sr-only">Step {index + 1}: </span>
                    {step.label}
                  </span>
                </li>
              ))}
            </ol>

            <div className="border-border bg-muted/40 rounded-lg border p-4">
              <p className="text-foreground flex items-start gap-2 text-sm font-medium">
                <IconCheck
                  aria-hidden="true"
                  className="text-primary mt-0.5 shrink-0"
                  size={16}
                />
                You can edit everything later
              </p>
              <p className="text-muted-foreground mt-1.5 text-sm leading-6">
                Names, descriptions, categories, and tags can be changed from
                the project page. The URL slug is the only detail fixed at
                creation.
              </p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="mt-8 max-w-2xl">
          <VerificationNotice email={session.user.email} />
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/dashboard/projects/new")({
  head: () => ({ meta: [{ title: "New project | VoxelVein" }] }),
  component: NewProjectPage,
});
