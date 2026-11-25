import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LIVE_EVENT_LABELS } from "@/lib/project-browser";
import type { LiveModEvent } from "@/lib/project-browser";
import type { ProjectSearchResponse } from "@/lib/project-search.functions";
import { PROJECT_TYPE_LABELS } from "@/lib/projects";
import type { ProjectType } from "@/lib/projects";
import { getMinecraftServerStatuses } from "@/lib/server-status.functions";

interface PaginationProps {
  currentPage: number;
  isSearching: boolean;
  onPageChange: (page: number) => void;
  totalPages: number;
}

const Pagination = ({
  currentPage,
  isSearching,
  onPageChange,
  totalPages,
}: PaginationProps) => {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Search results pagination"
      className="mt-8 flex items-center justify-center gap-2"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        disabled={currentPage <= 1 || isSearching}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
      >
        <IconChevronLeft size={16} aria-hidden="true" />
        Previous
      </Button>

      <span className="text-muted-foreground min-w-24 text-center text-sm">
        Page {currentPage} of {totalPages}
      </span>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        disabled={currentPage >= totalPages || isSearching}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
      >
        Next
        <IconChevronRight size={16} aria-hidden="true" />
      </Button>
    </nav>
  );
};

interface LiveEventBannerProps {
  event: LiveModEvent;
  onRefresh: () => void;
}

export const LiveEventBanner = ({ event, onRefresh }: LiveEventBannerProps) => (
  <output className="border-primary/30 bg-primary/5 text-foreground animate-in fade-in-0 slide-in-from-bottom-1 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm duration-300 motion-reduce:animate-none">
    <span>
      {LIVE_EVENT_LABELS[event.event]}: {event.data.name}
    </span>
    <Button variant="link" size="sm" onClick={onRefresh}>
      Refresh results
    </Button>
  </output>
);

export const ResultSkeletons = () => (
  <div
    aria-busy="true"
    className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
  >
    {Array.from({ length: 6 }, (_, index) => (
      <Skeleton key={index} className="h-52 rounded-xl" />
    ))}
  </div>
);

interface ResultsProps {
  currentPage: number;
  isSearching: boolean;
  onPageChange: (page: number) => void;
  result: ProjectSearchResponse;
  totalPages: number;
  type: ProjectType;
}

export const Results = ({
  currentPage,
  isSearching,
  onPageChange,
  result,
  totalPages,
  type,
}: ResultsProps) => {
  const projectIds =
    type === "server" ? result.hits.map((project) => project.id) : [];

  const { data: serverStatuses } = useQuery({
    enabled: projectIds.length > 0,
    queryFn: () => getMinecraftServerStatuses({ data: { projectIds } }),
    queryKey: ["minecraft-server-statuses", ...projectIds],
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 60_000,
  });

  return (
    <>
      <p className="text-muted-foreground mt-4 text-sm" aria-live="polite">
        {result.estimatedTotalHits}{" "}
        {(result.estimatedTotalHits === 1
          ? PROJECT_TYPE_LABELS[type].singular
          : PROJECT_TYPE_LABELS[type].plural
        ).toLowerCase()}{" "}
        found
      </p>

      <ul
        aria-busy={isSearching}
        className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {result.hits.map((project) => (
          <li
            key={project.id}
            className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"
          >
            <ProjectCard
              project={project}
              serverStatus={serverStatuses?.[project.id]}
              serverStatusManaged={type === "server"}
            />
          </li>
        ))}
      </ul>

      <Pagination
        currentPage={currentPage}
        isSearching={isSearching}
        onPageChange={onPageChange}
        totalPages={totalPages}
      />
    </>
  );
};
