import { IconArrowLeft, IconTrash, IconVersions } from "@tabler/icons-react";
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

import { ImageManager } from "@/components/dashboard/image-manager";
import { ProjectForm } from "@/components/dashboard/project-form";
import { PublishPanel } from "@/components/dashboard/publish-panel";
import { ServerForm } from "@/components/dashboard/server-form";
import { VersionForm } from "@/components/dashboard/version-form";
import { EmptyState } from "@/components/empty-state";
import { FilledPill } from "@/components/filled-pill";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/form-errors";
import { formatBytes, formatCount, formatDate } from "@/lib/format";
import type { ProjectImagesView } from "@/lib/project-images";
import {
  PROJECT_IMAGE_KIND,
  hasVersions,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPE_PATHS,
} from "@/lib/projects";
import type {
  ProjectInput,
  ProjectVersionView,
  ProjectView,
} from "@/lib/projects";
import {
  deleteProject,
  deleteVersion,
  getEditableProject,
  updateProject,
} from "@/lib/projects.functions";

const ROUTE_ID = "/dashboard/projects/$projectId";
const TABS = ["details", "images", "versions", "danger"] as const;
type Tab = (typeof TABS)[number];

/**
 * Section rhythm and measure follow the landing page, at the narrower
 * `max-w-3xl` band it uses for reading text. Matches the width cap on the
 * form fields closely enough that they read as one column.
 */
const PAGE_WIDTH = "mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8";

const searchSchema = object({ tab: optional(picklist(TABS)) });

const isTab = (value: string): value is Tab =>
  TABS.some((tab) => tab === value);

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
      <EmptyState
        description="Upload one with the form above. A project needs at least one version before it can be submitted for review."
        icon={<IconVersions size={24} aria-hidden="true" />}
        title="No versions uploaded yet"
        variant="inline"
      />
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
                    {formatCount(version.downloads)} downloads
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
        // The version number moves into the description so the title stays a stable
        // verb phrase, matching every other confirmation.
        title="Delete version"
        description={
          target
            ? `Delete version ${target.versionNumber}? Its files are deleted permanently and existing download links stop working. This can't be undone.`
            : ""
        }
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
      className="border-destructive/40 bg-destructive/5 rounded-xl border p-6"
    >
      <h2
        id="delete-heading"
        className="text-destructive text-lg font-semibold"
      >
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
        title="Delete project"
        description={`Delete ${project.name}? All versions and files are deleted permanently, and the project's URL becomes available to others. This can't be undone.`}
        confirmLabel="Delete project"
        size="md"
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

  // Image uploads answer with the new record, so the tab updates itself
  // rather than round-tripping the loader after every file.
  const [images, setImages] = useState<ProjectImagesView>({
    gallery: project.gallery,
    icon: project.icon,
  });

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
    <div className={PAGE_WIDTH}>
      <Link
        to="/dashboard/projects"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
      >
        <IconArrowLeft size={16} aria-hidden="true" />
        My projects
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
          {project.name}
        </h1>
        <FilledPill className="text-sm">
          {PROJECT_STATUS_LABELS[project.status]}
        </FilledPill>
      </div>
      <p className="text-muted-foreground mt-3 text-lg">
        {PROJECT_TYPE_LABELS[project.type].singular} ·{" "}
        {PROJECT_TYPE_PATHS[project.type]}/{project.slug}
      </p>

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
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="versions">
            {hasVersions(project.type)
              ? `Versions (${project.versions.length})`
              : "Server"}
          </TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
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

        <TabsContent value="images" className="grid gap-8 pt-4">
          <ImageManager
            kind={PROJECT_IMAGE_KIND.icon}
            icon={images.icon}
            projectId={project.id}
            projectName={project.name}
            onChange={(next) =>
              setImages((current) => ({ ...current, ...next }))
            }
          />
          <ImageManager
            kind={PROJECT_IMAGE_KIND.gallery}
            gallery={images.gallery}
            projectId={project.id}
            projectName={project.name}
            onChange={(next) =>
              setImages((current) => ({ ...current, ...next }))
            }
          />
        </TabsContent>

        {hasVersions(project.type) ? null : (
          <TabsContent value="versions" className="pt-4">
            <ServerForm
              key={project.updatedAt}
              projectId={project.id}
              server={project.server}
              onSaved={async () => {
                await reload();
                toast.success("Server saved");
              }}
            />
          </TabsContent>
        )}

        {hasVersions(project.type) ? (
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
        ) : null}

        <TabsContent value="danger" className="pt-4">
          <DangerZone project={project} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/** The manage page while `getEditableProject` is in flight. */
const ManageProjectSkeleton = () => (
  <div aria-busy="true" className={PAGE_WIDTH}>
    <Skeleton className="h-11 w-32" />
    <Skeleton className="mt-4 h-9 w-64" />
    <Skeleton className="mt-3 h-5 w-80 max-w-full" />
    <Skeleton className="mt-8 h-32 w-full rounded-xl" />
    <Skeleton className="mt-8 h-64 w-full rounded-xl" />
  </div>
);

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
  pendingComponent: ManageProjectSkeleton,
  validateSearch: (search: Record<string, string | undefined>) =>
    parse(searchSchema, search),
  loader: ({ params }) =>
    getEditableProject({ data: { projectId: params.projectId } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Manage ${loaderData.name} | VoxelVein`
          : "Manage project | VoxelVein",
      },
    ],
  }),
  component: ManageProjectPage,
  errorComponent: ProjectUnavailable,
});
