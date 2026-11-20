import {
  IconFolderOpen,
  IconPlus,
  IconSearch,
  IconSortAscending,
} from "@tabler/icons-react";
import {
  createFileRoute,
  Link,
  useLoaderData,
  useRouteContext,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ProjectSummaryCard } from "@/components/dashboard/project-summary-card";
import { VerificationNotice } from "@/components/dashboard/verification-notice";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/form-errors";
import {
  isProjectType,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPES,
} from "@/lib/projects";
import type {
  ProjectListItem,
  ProjectStatus,
  ProjectType,
} from "@/lib/projects";
import { deleteProject, listMyProjects } from "@/lib/projects.functions";
import { can } from "@/lib/roles";
import { cn } from "@/lib/utils";

const ROUTE_ID = "/dashboard/projects/";
const PAGE_SHELL =
  "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8";

type SortOption = "recent" | "name" | "downloads";

const SORT_LABELS: Record<SortOption, string> = {
  downloads: "Most downloaded",
  name: "Name",
  recent: "Recently updated",
};

/** `removed` projects are still shown, but filtering to them is not useful. */
const FILTERABLE_STATUSES = PROJECT_STATUSES.filter(
  (status) => status !== "removed"
);

const isSortOption = (value: string | null): value is SortOption =>
  value === "recent" || value === "name" || value === "downloads";

const sortProjects = (
  projects: ProjectListItem[],
  sort: SortOption
): ProjectListItem[] => {
  switch (sort) {
    case "name": {
      // oxlint-disable-next-line unicorn/no-array-sort -- The tsconfig target does not include ES2023 `toSorted`.
      return [...projects].sort((a, b) => a.name.localeCompare(b.name));
    }
    case "downloads": {
      // oxlint-disable-next-line unicorn/no-array-sort -- The tsconfig target does not include ES2023 `toSorted`.
      return [...projects].sort((a, b) => b.downloads - a.downloads);
    }
    default: {
      // oxlint-disable-next-line unicorn/no-array-sort -- The tsconfig target does not include ES2023 `toSorted`.
      return [...projects].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      );
    }
  }
};

const countStatuses = (
  projects: ProjectListItem[]
): Record<ProjectStatus, number> => {
  const counts: Record<ProjectStatus, number> = {
    draft: 0,
    pending: 0,
    published: 0,
    removed: 0,
  };
  for (const project of projects) {
    counts[project.status] += 1;
  }
  return counts;
};

/** The one-line summary under the page title, or null with no projects. */
const summarizeProjects = (
  projects: ProjectListItem[],
  counts: Record<ProjectStatus, number>
): string | null => {
  if (projects.length === 0) {
    return null;
  }

  const parts = [
    `${projects.length} ${projects.length === 1 ? "project" : "projects"}`,
  ];
  if (counts.published > 0) {
    parts.push(`${counts.published} published`);
  }
  if (counts.pending > 0) {
    parts.push(`${counts.pending} in review`);
  }
  if (counts.draft > 0) {
    parts.push(`${counts.draft} ${counts.draft === 1 ? "draft" : "drafts"}`);
  }
  return `${parts.join(", ")}.`;
};

/** The project list while `listMyProjects` is in flight. */
const MyProjectsSkeleton = () => (
  <div aria-busy="true" className={PAGE_SHELL}>
    <Skeleton className="h-10 w-56" />
    <Skeleton className="mt-3 h-5 w-96 max-w-full" />
    <Skeleton className="mt-8 h-28 w-full rounded-2xl" />
    <div className="mt-4 grid gap-3">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-28 rounded-xl" />
      ))}
    </div>
  </div>
);

const NewProjectButton = ({ className }: { className?: string }) => (
  <Button
    className={cn("min-h-11 px-4", className)}
    render={<Link to="/dashboard/projects/new" />}
  >
    <IconPlus aria-hidden="true" />
    New project
  </Button>
);

interface ProjectFiltersProps {
  availableTypes: readonly ProjectType[];
  onClearFilters: () => void;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: SortOption) => void;
  onStatusChange: (status: ProjectStatus | "all") => void;
  onTypeChange: (type: ProjectType | "all") => void;
  projects: ProjectListItem[];
  query: string;
  sort: SortOption;
  status: ProjectStatus | "all";
  statusCounts: Record<ProjectStatus, number>;
  type: ProjectType | "all";
}

/** Search, type, sort, and status controls above the project list. */
const ProjectFilters = ({
  availableTypes,
  onClearFilters,
  onQueryChange,
  onSortChange,
  onStatusChange,
  onTypeChange,
  projects,
  query,
  sort,
  status,
  statusCounts,
  type,
}: ProjectFiltersProps) => (
  <section
    aria-label="Search and filter projects"
    className="border-border bg-card mt-8 rounded-2xl border p-4 sm:p-5"
  >
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_11rem_12rem]">
      <div className="grid content-start gap-1.5">
        <label
          className="text-foreground text-sm font-medium"
          htmlFor="project-search"
        >
          Search
        </label>
        <div className="relative">
          <IconSearch
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            size={17}
          />
          <Input
            id="project-search"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Name, category, type, or slug"
            className="min-h-11 pl-9"
          />
        </div>
      </div>

      <div className="grid content-start gap-1.5">
        <label
          className="text-foreground text-sm font-medium"
          htmlFor="project-type-filter"
        >
          Type
        </label>
        <Select
          items={[
            { label: "All types", value: "all" },
            ...availableTypes.map((projectType) => ({
              label: PROJECT_TYPE_LABELS[projectType].plural,
              value: projectType,
            })),
          ]}
          value={type}
          onValueChange={(value) => {
            if (value !== null && (value === "all" || isProjectType(value))) {
              onTypeChange(value);
            }
          }}
        >
          <SelectTrigger id="project-type-filter" className="min-h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {availableTypes.map((projectType) => (
              <SelectItem key={projectType} value={projectType}>
                {PROJECT_TYPE_LABELS[projectType].plural}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid content-start gap-1.5">
        <label
          className="text-foreground text-sm font-medium"
          htmlFor="project-sort"
        >
          Sort by
        </label>
        <Select
          items={Object.entries(SORT_LABELS).map(([value, label]) => ({
            label,
            value,
          }))}
          value={sort}
          onValueChange={(value) => {
            if (isSortOption(value)) {
              onSortChange(value);
            }
          }}
        >
          <SelectTrigger id="project-sort" className="min-h-11 w-full">
            <SelectValue>
              <IconSortAscending aria-hidden="true" size={16} />
              {SORT_LABELS[sort]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>

    <section
      aria-label="Filter by status"
      className="border-border mt-4 flex flex-wrap items-center gap-2 border-t pt-4"
    >
      <span className="text-muted-foreground mr-1 text-sm font-medium">
        Status
      </span>
      <StatusChip
        active={status === "all"}
        count={projects.length}
        label="All"
        onClick={() => onStatusChange("all")}
      />
      {FILTERABLE_STATUSES.map((value) => (
        <StatusChip
          key={value}
          active={status === value}
          count={statusCounts[value]}
          label={PROJECT_STATUS_LABELS[value]}
          onClick={() => onStatusChange(value)}
        />
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ml-auto min-h-10"
        onClick={onClearFilters}
      >
        Clear filters
      </Button>
    </section>
  </section>
);

const StatusChip = ({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      "focus-visible:ring-ring min-h-10 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none",
      active
        ? "border-primary/30 bg-primary/10 text-primary"
        : "border-border bg-background text-muted-foreground hover:text-foreground"
    )}
  >
    {label} <span className="ml-1 tabular-nums">{count}</span>
  </button>
);

interface ProjectResultsProps {
  onClearFilters: () => void;
  onDelete: (project: ProjectListItem) => void;
  projects: ProjectListItem[];
  sortedProjects: ProjectListItem[];
}

/** The result count and either the project rows or a no-match state. */
const ProjectResults = ({
  onClearFilters,
  onDelete,
  projects,
  sortedProjects,
}: ProjectResultsProps) => (
  <>
    <p className="text-muted-foreground mt-5 text-sm" aria-live="polite">
      Showing {sortedProjects.length} of {projects.length} projects
    </p>

    {sortedProjects.length === 0 ? (
      <EmptyState
        icon={<IconSearch size={22} aria-hidden="true" />}
        title="No matching projects"
        description="Try a different search, type, or status filter."
        action={
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={onClearFilters}
          >
            Clear filters
          </Button>
        }
        variant="inline"
      />
    ) : (
      <ul className="border-border bg-card divide-border mt-3 divide-y overflow-hidden rounded-2xl border">
        {sortedProjects.map((project) => (
          <li key={project.id}>
            <ProjectSummaryCard project={project} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    )}
  </>
);

const MyProjectsPage = () => {
  const projects = useLoaderData({ from: ROUTE_ID });
  const { session } = useRouteContext({ from: ROUTE_ID });
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "all">("all");
  const [type, setType] = useState<ProjectType | "all">("all");
  const [sort, setSort] = useState<SortOption>("recent");
  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(
    null
  );
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canUpload =
    session.user.emailVerified || can(session.user.role, "reviewProjects");
  const normalizedQuery = query.trim().toLowerCase();
  const availableTypes = PROJECT_TYPES.filter((projectType) =>
    projects.some((project) => project.type === projectType)
  );
  const statusCounts = countStatuses(projects);
  const summary = summarizeProjects(projects, statusCounts);

  const filteredProjects = projects.filter((project) => {
    const matchesStatus = status === "all" || project.status === status;
    const matchesType = type === "all" || project.type === type;
    const searchable = [
      project.name,
      project.summary,
      project.slug,
      project.category,
      project.type,
      PROJECT_TYPE_LABELS[project.type].singular,
      PROJECT_STATUS_LABELS[project.status],
    ]
      .join(" ")
      .toLowerCase();
    return matchesStatus && matchesType && searchable.includes(normalizedQuery);
  });
  const sortedProjects = sortProjects(filteredProjects, sort);

  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setType("all");
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    setDeletePending(true);
    setDeleteError(null);
    try {
      await deleteProject({ data: { projectId: deleteTarget.id } });
      toast.success(`Deleted ${deleteTarget.name}`);
      setDeleteTarget(null);
      await router.invalidate();
    } catch (error) {
      setDeleteError(errorMessage(error, "Could not delete the project."));
    }
    setDeletePending(false);
  };

  return (
    <div className={PAGE_SHELL}>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-primary text-sm font-medium">Creator workspace</p>
          <h1 className="text-foreground mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Projects
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6 sm:text-base">
            Manage listings, releases, and drafts. Everything you publish starts
            here.
          </p>
          {summary ? (
            <p className="text-muted-foreground mt-3 text-sm">{summary}</p>
          ) : null}
        </div>
        {canUpload ? <NewProjectButton /> : null}
      </header>

      {canUpload ? null : (
        <div className="mt-8 max-w-3xl">
          <VerificationNotice email={session.user.email} />
        </div>
      )}

      {projects.length === 0 ? (
        <div className="border-border bg-card mt-8 rounded-2xl border p-6 sm:p-10">
          <EmptyState
            icon={<IconFolderOpen size={24} aria-hidden="true" />}
            title="Your workspace is ready"
            description={
              canUpload
                ? "Create your first project to start sharing it with the community."
                : "Once your email is verified, you can create your first project."
            }
            action={canUpload ? <NewProjectButton /> : undefined}
          />
        </div>
      ) : (
        <>
          <ProjectFilters
            availableTypes={availableTypes}
            onClearFilters={clearFilters}
            onQueryChange={setQuery}
            onSortChange={setSort}
            onStatusChange={setStatus}
            onTypeChange={setType}
            projects={projects}
            query={query}
            sort={sort}
            status={status}
            statusCounts={statusCounts}
            type={type}
          />

          <ProjectResults
            onClearFilters={clearFilters}
            onDelete={(target) => {
              setDeleteError(null);
              setDeleteTarget(target);
            }}
            projects={projects}
            sortedProjects={sortedProjects}
          />
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        title="Delete project"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name}? All versions, files, and images are deleted permanently, and the project's URL becomes available to others. This can't be undone.`
            : ""
        }
        confirmLabel="Delete project"
        size="md"
        onConfirm={handleDelete}
        pending={deletePending}
        error={deleteError}
      />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/projects/")({
  pendingComponent: MyProjectsSkeleton,
  loader: () => listMyProjects(),
  head: () => ({ meta: [{ title: "My projects | VoxelVein" }] }),
  component: MyProjectsPage,
});
