import { IconExternalLink, IconTrash } from "@tabler/icons-react";
import {
  createFileRoute,
  Link,
  useLoaderData,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { optional, parse, picklist, object } from "valibot";

import { ProjectForm } from "@/components/dashboard/project-form";
import { VersionForm } from "@/components/dashboard/version-form";
import { PageHeader } from "@/components/page-header";
import { ProjectLink } from "@/components/projects/project-link";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/form-errors";
import { formatBytes, formatDate } from "@/lib/format";
import { PROJECT_TYPE_LABELS } from "@/lib/projects";
import type {
  ProjectInput,
  ProjectVersionView,
  ProjectView,
} from "@/lib/projects";
import {
  deleteProject,
  deleteVersion,
  getEditableProject,
  setProjectPublished,
  updateProject,
} from "@/lib/projects.functions";

const ROUTE_ID = "/dashboard/projects/$projectId";
const TABS = ["details", "versions", "danger"] as const;
type Tab = (typeof TABS)[number];

const searchSchema = object({ tab: optional(picklist(TABS)) });

const isTab = (value: string): value is Tab =>
  TABS.some((tab) => tab === value);

const PublishPanel = ({
  onChange,
  project,
}: {
  onChange: () => Promise<void>;
  project: ProjectView;
}) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPublished = project.status === "published";
  const hasFiles = project.versions.some((version) => version.files.length);

  const toggle = async () => {
    setError(null);
    setPending(true);
    try {
      await setProjectPublished({
        data: { projectId: project.id, published: !isPublished },
      });
      await onChange();
      toast.success(isPublished ? "Moved back to drafts" : "Published");
    } catch (toggleError) {
      setError(errorMessage(toggleError, "Could not change visibility."));
    }
    setPending(false);
  };

  return (
    <section
      aria-labelledby="visibility-heading"
      className="border-border bg-card rounded-xl border p-6"
    >
      <h2
        id="visibility-heading"
        className="text-foreground text-lg font-semibold"
      >
        {isPublished ? "Published" : "Draft"}
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        {isPublished
          ? "Everyone can find and download this project."
          : "Only you and admins can see this project."}
        {!isPublished && !hasFiles
          ? " Upload a version with a file before publishing."
          : null}
      </p>
      {error ? (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant={isPublished ? "outline" : "default"}
          className="min-h-11"
          disabled={pending || (!isPublished && !hasFiles)}
          onClick={toggle}
        >
          {isPublished ? "Unpublish" : "Publish"}
        </Button>
        <Button
          render={
            <ProjectLink type={project.type} slug={project.slug}>
              {null}
            </ProjectLink>
          }
          nativeButton={false}
          variant="ghost"
          className="min-h-11"
        >
          <IconExternalLink size={16} aria-hidden="true" />
          View page
        </Button>
      </div>
    </section>
  );
};

const VersionList = ({
  onChange,
  versions,
}: {
  onChange: () => Promise<void>;
  versions: ProjectVersionView[];
}) => {
  const [target, setTarget] = useState<ProjectVersionView | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (versions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No versions uploaded yet.</p>
    );
  }

  const confirmDelete = async () => {
    if (!target) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await deleteVersion({ data: { versionId: target.id } });
      setTarget(null);
      await onChange();
      toast.success(`Deleted version ${target.versionNumber}`);
    } catch (deleteError) {
      setError(errorMessage(deleteError, "Could not delete the version."));
    }
    setPending(false);
  };

  return (
    <>
      <ul className="grid gap-3">
        {versions.map((version) => (
          <li
            key={version.id}
            className="border-border bg-card flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4"
          >
            <div className="min-w-0">
              <p className="text-foreground font-semibold">
                {version.versionNumber}{" "}
                <span className="text-muted-foreground text-sm font-normal capitalize">
                  · {version.channel} · {formatDate(version.createdAt)}
                </span>
              </p>
              <p className="text-muted-foreground text-sm capitalize">
                {version.loaders.join(", ")} · {version.gameVersions.join(", ")}
              </p>
              <ul className="text-muted-foreground mt-1 text-xs">
                {version.files.map((file) => (
                  <li key={file.id} className="break-all">
                    {file.filename} · {formatBytes(file.size)} ·{" "}
                    {version.downloads} downloads
                  </li>
                ))}
              </ul>
            </div>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              onClick={() => setTarget(version)}
            >
              <IconTrash size={16} aria-hidden="true" />
              Delete
              <span className="sr-only"> version {version.versionNumber}</span>
            </Button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            setError(null);
          }
        }}
        title={`Delete version ${target?.versionNumber ?? ""}?`}
        description="Its files are deleted permanently and existing download links stop working. This can't be undone."
        confirmLabel="Delete version"
        onConfirm={confirmDelete}
        pending={pending}
        error={error}
      />
    </>
  );
};

const DangerZone = ({ project }: { project: ProjectView }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = async () => {
    setPending(true);
    setError(null);
    try {
      await deleteProject({ data: { projectId: project.id } });
      toast.success(`Deleted ${project.name}`);
      await navigate({ to: "/dashboard/projects" });
    } catch (deleteError) {
      setError(errorMessage(deleteError, "Could not delete the project."));
      setPending(false);
    }
  };

  return (
    <section
      aria-labelledby="delete-heading"
      className="border-destructive/40 rounded-xl border p-6"
    >
      <h2 id="delete-heading" className="text-foreground text-lg font-semibold">
        Delete project
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Permanently deletes {project.name}, all of its versions, and every
        uploaded file.
      </p>
      <Button
        type="button"
        variant="destructive"
        className="mt-4 min-h-11"
        onClick={() => setOpen(true)}
      >
        <IconTrash size={16} aria-hidden="true" />
        Delete project
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setError(null);
          }
        }}
        title={`Delete ${project.name}?`}
        description="All versions and files are deleted permanently, and the project's URL becomes available to others. This can't be undone."
        confirmLabel="Delete project"
        onConfirm={confirmDelete}
        pending={pending}
        error={error}
      />
    </section>
  );
};

const ManageProjectPage = () => {
  const project = useLoaderData({ from: ROUTE_ID });
  const { tab = "details" } = useSearch({
    from: ROUTE_ID,
  });
  const navigate = useNavigate({ from: ROUTE_ID });
  const router = useRouter();

  const reload = () => router.invalidate();

  const handleDetails = async (input: ProjectInput) => {
    await updateProject({
      data: {
        category: input.category,
        description: input.description,
        name: input.name,
        projectId: project.id,
        summary: input.summary,
        tags: input.tags,
      },
    });
    await reload();
    toast.success("Project saved");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <Link
        to="/dashboard/projects"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
      >
        ← My projects
      </Link>
      <div className="mt-4">
        <PageHeader
          title={project.name}
          description={`${PROJECT_TYPE_LABELS[project.type].singular} · /${project.type}s/${project.slug}`}
        />
      </div>

      <div className="mt-8">
        <PublishPanel project={project} onChange={reload} />
      </div>

      <Tabs
        className="mt-8"
        value={tab}
        onValueChange={(value) => {
          if (isTab(value)) {
            void navigate({ replace: true, search: { tab: value } });
          }
        }}
      >
        <TabsList aria-label="Project sections">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="danger">Danger zone</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-4">
          <ProjectForm
            key={project.updatedAt}
            mode="edit"
            submitLabel="Save changes"
            initialValues={{
              category: project.category,
              description: project.description,
              name: project.name,
              slug: project.slug,
              summary: project.summary,
              tags: project.tags.join(", "),
              type: project.type,
            }}
            onSubmit={handleDetails}
          />
        </TabsContent>

        <TabsContent value="versions" className="grid gap-10 pt-4">
          <section aria-labelledby="new-version-heading">
            <h2
              id="new-version-heading"
              className="text-foreground mb-4 text-lg font-semibold"
            >
              New version
            </h2>
            <VersionForm
              projectId={project.id}
              projectType={project.type}
              onCreated={async () => {
                await reload();
                toast.success("Version uploaded");
              }}
            />
          </section>
          <section aria-labelledby="versions-heading">
            <h2
              id="versions-heading"
              className="text-foreground mb-4 text-lg font-semibold"
            >
              Versions
            </h2>
            <VersionList versions={project.versions} onChange={reload} />
          </section>
        </TabsContent>

        <TabsContent value="danger" className="pt-4">
          <DangerZone project={project} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const ProjectUnavailable = ({ error }: ErrorComponentProps) => (
  <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
    <PageHeader
      title="Project unavailable"
      description={
        error instanceof Error ? error.message : "Something went wrong."
      }
    />
    <Link
      to="/dashboard/projects"
      className="text-primary focus-visible:ring-ring mt-6 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
    >
      Back to my projects
    </Link>
  </div>
);

export const Route = createFileRoute("/dashboard/projects/$projectId")({
  validateSearch: (search: Record<string, string | undefined>) =>
    parse(searchSchema, search),
  loader: ({ params }) =>
    getEditableProject({ data: { projectId: params.projectId } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Manage ${loaderData.name} — VoxelVein`
          : "Manage project — VoxelVein",
      },
    ],
  }),
  component: ManageProjectPage,
  errorComponent: ProjectUnavailable,
});
