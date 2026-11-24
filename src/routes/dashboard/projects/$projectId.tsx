import {
  IconArrowsExchange,
  IconArrowLeft,
  IconTrash,
  IconVersions,
} from "@tabler/icons-react";
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

import { ImageManager } from "@/components/dashboard/image-manager";
import { ProjectForm } from "@/components/dashboard/project-form";
import {
  ProjectMobileNav,
  ProjectSidebar,
} from "@/components/dashboard/project-sidebar";
import { PublishPanel } from "@/components/dashboard/publish-panel";
import { ServerForm } from "@/components/dashboard/server-form";
import { VersionForm } from "@/components/dashboard/version-form";
import { VotingSettings } from "@/components/dashboard/voting-settings";
import { EmptyState } from "@/components/empty-state";
import { FilledPill } from "@/components/filled-pill";
import { FormField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { errorMessage } from "@/lib/form-errors";
import { formatBytes, formatCount, formatDate } from "@/lib/format";
import type { ProjectImagesView } from "@/lib/project-images";
import {
  parseProjectSearch,
  PROJECT_TABS,
  resolveProjectTab,
} from "@/lib/project-tabs";
import type { ProjectTab } from "@/lib/project-tabs";
import { requestProjectTransfer } from "@/lib/project-transfers.functions";
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
import {
  MODPACK_PLATFORMS,
  normalizePlatformId,
  platformLabel,
} from "@/lib/release-platforms";
import { deleteVersionFile, uploadVersionFile } from "@/lib/upload-client";

const ROUTE_ID = "/dashboard/projects/$projectId";

const getCustomPlatformIds = (versions: ProjectVersionView[]): string[] => {
  const ids = new Set<string>();

  for (const version of versions) {
    for (const file of version.files) {
      if (
        file.platform &&
        !MODPACK_PLATFORMS.some((known) => known.id === file.platform)
      ) {
        ids.add(file.platform);
      }
    }
  }

  return [...ids];
};

/**
 * The editor uses the same page rhythm and mini-sidebar as Settings and the
 * Admin panel. Reading columns keep a narrower measure inside that layout.
 */
const PAGE_WIDTH =
  "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8";

const VersionPlatformFileForm = ({
  onChange,
  options,
  projectId,
  version,
}: {
  onChange: () => Promise<void>;
  options: { id: string; label: string }[];
  projectId: string;
  version: ProjectVersionView;
}) => {
  const [platform, setPlatform] = useState("modrinth");
  const [customPlatform, setCustomPlatform] = useState("");
  const [platformFile, setPlatformFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [pending, setPending] = useState(false);

  const handleUpload = async () => {
    if (!platformFile) {
      return;
    }

    const uploadPlatform =
      platform === "other" ? normalizePlatformId(customPlatform) : platform;

    if (!uploadPlatform) {
      toast.error("Enter a valid platform name.");

      return;
    }

    setPending(true);

    try {
      await uploadVersionFile({
        file: platformFile,
        platform: uploadPlatform,
        versionId: version.id,
        projectId,
      });
      setPlatformFile(null);
      setInputKey((key) => key + 1);
      await onChange();
      setPlatform(uploadPlatform);
      setCustomPlatform("");
      toast.success(`${platformLabel(uploadPlatform)} download saved`);
    } catch (uploadError) {
      toast.error(
        errorMessage(uploadError, "Could not upload this platform file.")
      );
    }

    setPending(false);
  };

  return (
    <div className="border-border mt-3 grid gap-3 border-t pt-3 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(0,1.2fr)_auto]">
      <div className="grid content-start gap-2">
        <label
          htmlFor={`platform-${version.id}`}
          className="text-foreground text-sm font-medium"
        >
          Platform
        </label>
        <Select
          items={[
            ...options.map(({ id, label }) => ({ label, value: id })),
            { label: "Other…", value: "other" },
          ]}
          value={platform}
          onValueChange={(value) => value && setPlatform(value)}
        >
          <SelectTrigger
            id={`platform-${version.id}`}
            className="min-h-11 w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(({ id, label }) => (
              <SelectItem key={id} value={id}>
                {label}
              </SelectItem>
            ))}
            <SelectItem value="other">Other…</SelectItem>
          </SelectContent>
        </Select>
        {platform === "other" ? (
          <FormField
            id={`platform-name-${version.id}`}
            label="Platform name"
            value={customPlatform}
            onChange={(event) => setCustomPlatform(event.target.value)}
            placeholder="ATLauncher"
            autoComplete="off"
          />
        ) : null}
      </div>
      <FormField
        key={inputKey}
        id={`platform-file-${version.id}`}
        label="Upload or replace file"
        type="file"
        accept=".mrpack,.zip,application/x-modrinth-modpack+zip,application/zip"
        onChange={(event) => setPlatformFile(event.target.files?.[0] ?? null)}
        helperText={
          platformFile
            ? `${platformFile.name} · ${formatBytes(platformFile.size)}`
            : "Choose a .mrpack or .zip archive."
        }
      />
      <Button
        type="button"
        className="min-h-11 self-end"
        disabled={pending || !platformFile}
        onClick={handleUpload}
      >
        {pending ? "Uploading…" : "Save file"}
      </Button>
    </div>
  );
};

const VersionList = ({
  onChange,
  versions,
  projectId,
  projectType,
}: {
  onChange: () => Promise<void>;
  projectId: string;
  projectType: ProjectView["type"];
  versions: ProjectVersionView[];
}) => {
  const [target, setTarget] = useState<ProjectVersionView | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fileTarget, setFileTarget] = useState<{
    fileId: string;
    version: ProjectVersionView;
  } | null>(null);

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

  const platformOptions = [
    ...MODPACK_PLATFORMS.map(({ id, label }) => ({ id, label })),
    ...getCustomPlatformIds(versions).map((id) => ({
      id,
      label: platformLabel(id),
    })),
  ];

  const confirmDeleteFile = async () => {
    if (!fileTarget) {
      return;
    }

    setPending(true);

    try {
      await deleteVersionFile({
        fileId: fileTarget.fileId,
        versionId: fileTarget.version.id,
        projectId,
      });
      toast.success("Platform download removed");
      setFileTarget(null);
      await onChange();
    } catch (deleteError) {
      setError(errorMessage(deleteError, "Could not remove this file."));
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
                  <li
                    key={file.id}
                    className="flex flex-wrap items-center justify-between gap-2 break-all"
                  >
                    <span>
                      {projectType === "modpack"
                        ? `${platformLabel(file.platform)} · `
                        : ""}
                      {file.filename} · {formatBytes(file.size)} ·{" "}
                      {formatCount(version.downloads)} downloads
                    </span>
                    {projectType === "modpack" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-9"
                        onClick={() =>
                          setFileTarget({ fileId: file.id, version })
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {projectType === "modpack" ? (
                <VersionPlatformFileForm
                  key={version.id}
                  onChange={onChange}
                  options={platformOptions}
                  projectId={projectId}
                  version={version}
                />
              ) : null}
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
      <ConfirmDialog
        open={fileTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFileTarget(null);
            setError(null);
          }
        }}
        title="Remove platform download"
        description="Remove this file from the release? The other platform downloads and release metadata will stay in place. This can't be undone."
        confirmLabel="Remove file"
        onConfirm={confirmDeleteFile}
        pending={pending}
        error={error}
      />
    </>
  );
};

const TransferOwnership = ({ project }: { project: ProjectView }) => {
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (session?.user.id !== project.ownerId) {
    return null;
  }

  const submit = async () => {
    setPending(true);
    setError(null);

    try {
      const result = await requestProjectTransfer({
        data: {
          password: password || undefined,
          projectId: project.id,
          recipient,
        },
      });

      toast.success(
        `Offer sent to ${result.recipientName}. They have seven days to accept.`
      );
      setOpen(false);
      setRecipient("");
      setPassword("");
    } catch (transferError) {
      setError(errorMessage(transferError, "Could not send the offer."));
    }

    setPending(false);
  };

  return (
    <section
      aria-labelledby="transfer-heading"
      className="border-border bg-card rounded-xl border p-6"
    >
      <h2
        className="text-foreground text-lg font-semibold"
        id="transfer-heading"
      >
        Transfer ownership
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Offer this project to another member. Nothing changes until they accept,
        and the offer expires after seven days.
      </p>
      <Button
        className="mt-4 min-h-11"
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        <IconArrowsExchange aria-hidden size={16} />
        Transfer project
      </Button>

      <Dialog
        onOpenChange={(next) => {
          setOpen(next);

          if (!next) {
            setError(null);
          }
        }}
        open={open}
      >
        <DialogContent>
          <DialogTitle>Transfer {project.name}</DialogTitle>
          <DialogDescription>
            Enter the username or email of the member who should own this
            project. They can decline.
          </DialogDescription>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <FormField
              helperText="Their username or email address."
              id={`transfer-recipient-${project.id}`}
              label="Recipient"
              onChange={(event) => setRecipient(event.target.value)}
              required
              value={recipient}
            />
            <FormField
              autoComplete="current-password"
              helperText="A sign-in within the last ten minutes also counts."
              id={`transfer-password-${project.id}`}
              label="Confirm your password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                disabled={pending}
                onClick={() => setOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={pending} type="submit">
                {pending ? "Sending…" : "Send offer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
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
    }

    setPending(false);
  };

  return (
    <>
      <TransferOwnership project={project} />
      <section
        aria-labelledby="delete-heading"
        className="border-destructive/40 bg-destructive/5 mt-6 rounded-xl border p-6"
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
    </>
  );
};

const ManageProjectPage = () => {
  const project = useLoaderData({ from: ROUTE_ID });

  const activeTab = resolveProjectTab(useSearch({ from: ROUTE_ID }));
  const hasReleaseVersions = hasVersions(project.type);

  const navigate = useNavigate({ from: ROUTE_ID });
  const router = useRouter();

  const selectTab = (value: ProjectTab) => {
    // The search parameter is the source of truth, and `replace` keeps section
    // hops from filling browser history.
    void navigate({ replace: true, search: { tab: value } });
  };

  const sidebarProps = {
    activeTab,
    hasVersions: hasReleaseVersions,
    onSelect: selectTab,
    versionCount: project.versions.length,
  };

  const activeLabel =
    activeTab === "versions" && !hasReleaseVersions
      ? "Server"
      : (PROJECT_TABS.find((entry) => entry.value === activeTab)?.label ??
        "Project");

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
        disclosures: input.disclosures,
        name: input.name,
        projectId: project.id,
        slug: input.slug,
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
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
      >
        <IconArrowLeft size={16} aria-hidden="true" />
        My projects
      </Link>

      <PageHeader
        title={project.name}
        description={`${PROJECT_TYPE_LABELS[project.type].singular} · ${PROJECT_TYPE_PATHS[project.type]}/${project.slug}`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <FilledPill className="text-sm">
              {PROJECT_STATUS_LABELS[project.status]}
            </FilledPill>
            <ProjectMobileNav {...sidebarProps} />
          </div>
        }
      />

      <div className="mt-8 max-w-3xl">
        <PublishPanel project={project} onChange={reload} />
      </div>

      <div className="mt-8 flex flex-col items-start gap-6 lg:flex-row lg:gap-8">
        <ProjectSidebar {...sidebarProps} />

        <section aria-label={activeLabel} className="min-w-0 flex-1">
          {activeTab === "details" ? (
            <ProjectForm
              key={project.updatedAt}
              mode="edit"
              submitLabel="Save changes"
              initialValues={{
                category: project.category,
                description: project.description,
                disclosures: project.disclosures,
                name: project.name,
                slug: project.slug,
                summary: project.summary,
                tags: project.tags.join(", "),
                type: project.type,
              }}
              onSubmit={handleDetails}
            />
          ) : null}

          {activeTab === "images" ? (
            <div className="grid max-w-3xl gap-8">
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
            </div>
          ) : null}

          {activeTab === "versions" && !hasReleaseVersions ? (
            <section aria-labelledby="server-heading" className="max-w-3xl">
              <h2
                id="server-heading"
                className="text-foreground mb-4 text-lg font-semibold"
              >
                Server details
              </h2>
              <ServerForm
                key={project.updatedAt}
                projectId={project.id}
                server={project.server}
                onSaved={async () => {
                  await reload();
                  toast.success("Server saved");
                }}
              />
              <div className="mt-10">
                <VotingSettings projectId={project.id} />
              </div>
            </section>
          ) : null}

          {activeTab === "versions" && hasReleaseVersions ? (
            <div className="grid gap-10">
              <section aria-labelledby="new-version-heading">
                <h2
                  id="new-version-heading"
                  className="text-foreground mb-4 text-lg font-semibold"
                >
                  Add a version
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
                  Uploaded versions
                </h2>
                <VersionList
                  versions={project.versions}
                  projectId={project.id}
                  projectType={project.type}
                  onChange={reload}
                />
              </section>
            </div>
          ) : null}

          {activeTab === "danger" ? (
            <div className="max-w-3xl">
              <DangerZone project={project} />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};

/** The manage page while `getEditableProject` is in flight. */
const ManageProjectSkeleton = () => (
  <div aria-busy="true" className={PAGE_WIDTH}>
    <Skeleton className="h-11 w-32" />
    <Skeleton className="mt-4 h-9 w-64" />
    <Skeleton className="mt-3 h-5 w-80 max-w-full" />
    <Skeleton className="mt-8 h-32 w-full max-w-3xl rounded-xl" />
    <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:gap-8">
      <Skeleton className="hidden h-64 w-60 rounded-xl lg:block" />
      <div className="grid flex-1 gap-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
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
  validateSearch: parseProjectSearch,
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
