import {
  createFileRoute,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";

import { ProjectForm } from "@/components/dashboard/project-form";
import { VerificationNotice } from "@/components/dashboard/verification-notice";
import { PageHeader } from "@/components/page-header";
import type { ProjectInput } from "@/lib/projects";
import { createProject } from "@/lib/projects.functions";

const NewProjectPage = () => {
  const { session } = useRouteContext({ from: "/dashboard/projects/new" });
  const navigate = useNavigate();
  const canUpload = session.user.emailVerified || session.user.role === "admin";

  const handleSubmit = async (input: ProjectInput) => {
    const { id } = await createProject({ data: input });
    await navigate({
      params: { projectId: id },
      search: { tab: "versions" },
      to: "/dashboard/projects/$projectId",
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <PageHeader
        title="New project"
        description="Projects start as drafts. Add a version with a file, then publish."
      />
      {canUpload ? (
        <div className="mt-8">
          <ProjectForm
            mode="create"
            submitLabel="Create draft"
            onSubmit={handleSubmit}
          />
        </div>
      ) : (
        <VerificationNotice />
      )}
    </div>
  );
};

export const Route = createFileRoute("/dashboard/projects/new")({
  head: () => ({ meta: [{ title: "New project — VoxelVein" }] }),
  component: NewProjectPage,
});
