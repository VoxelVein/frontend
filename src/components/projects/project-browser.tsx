import { IconPackage, IconSearchOff } from "@tabler/icons-react";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { ProjectBrowserFilters } from "@/components/projects/project-browser-filters";
import {
  LiveEventBanner,
  ResultSkeletons,
  Results,
} from "@/components/projects/project-browser-results";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectBrowser } from "@/hooks/use-project-browser";
import { categoryIconForPath } from "@/lib/categories";
import type { ProjectBrowserData } from "@/lib/project-browser-loader";
import {
  PROJECT_TYPE_DESCRIPTIONS,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPE_PATHS,
} from "@/lib/projects";
import type { ProjectType } from "@/lib/projects";

/**
 * The icon for the browse empty state.
 *
 * A filtered page that matched nothing is a search that failed, so it gets the
 * search glyph. An unfiltered empty page is simply a section with nothing in it
 * yet, and gets that section's own icon from the category registry  -  the same
 * one its navbar entry, explore tile, and footer link already use. A generic
 * "nothing found" mark on a page nobody searched reads as an error.
 *
 * A plain function rather than a component: the icon is chosen from a lookup
 * and rendering `<Icon />` would otherwise define a component during render.
 */
const emptyStateIcon = (type: ProjectType, isFiltered: boolean) => {
  if (isFiltered) {
    return <IconSearchOff size={24} aria-hidden="true" />;
  }

  const Icon = categoryIconForPath(PROJECT_TYPE_PATHS[type]);

  if (Icon) {
    return <Icon size={24} aria-hidden="true" />;
  }

  return <IconPackage size={24} aria-hidden="true" />;
};

/** The category mark in the page header, as an element rather than a component. */
const headerIcon = (type: ProjectType) => {
  const Icon = categoryIconForPath(PROJECT_TYPE_PATHS[type]) ?? IconPackage;

  return <Icon size={22} aria-hidden="true" />;
};

interface BrowseEmptyStateProps {
  filtersActive: boolean;
  label: string;
  onClearFilters: () => void;
  type: ProjectType;
}

const BrowseEmptyState = ({
  filtersActive,
  label,
  onClearFilters,
  type,
}: BrowseEmptyStateProps) => (
  <EmptyState
    icon={emptyStateIcon(type, filtersActive)}
    title={
      filtersActive
        ? `No ${label.toLowerCase()} found`
        : `No ${label.toLowerCase()} yet`
    }
    description={
      filtersActive
        ? "Try a different search or clear your filters."
        : `Once ${label.toLowerCase()} are published, the newest ones show up here.`
    }
    action={
      filtersActive ? (
        <Button variant="link" onClick={onClearFilters}>
          Clear filters
        </Button>
      ) : null
    }
  />
);

interface ProjectBrowserProps extends ProjectBrowserData {
  type: ProjectType;
}

export const ProjectBrowser = ({
  initial,
  initialError,
  type,
}: ProjectBrowserProps) => {
  const {
    categories,
    category,
    clearFilters,
    clientRequirement,
    error,
    filterCount,
    filtersActive,
    gameVersion,
    isSearching,
    liveEvent,
    loader,
    onCategoryChange,
    onClientRequirementChange,
    onGameVersionChange,
    onLoaderChange,
    onSortChange,
    page,
    query,
    refreshFromLiveEvent,
    result,
    retry,
    setPage,
    setQuery,
    sort,
    totalPages,
  } = useProjectBrowser({ initial, initialError, type });

  // Shared by the heading, the empty state and the results summary so the
  // three cannot disagree on what this section is called.
  const label = PROJECT_TYPE_LABELS[type].plural;
  const showSkeletons = isSearching && !result && !error;

  const showEmpty =
    !isSearching && !error && result && result.hits.length === 0;

  const showResults =
    !isSearching && !error && result && result.hits.length > 0;

  // If the loader returned no data and no error (e.g. first paint before the
  // client search resolves), keep skeletons visible instead of a blank page.
  const showInitialSkeletons = !isSearching && !error && !result;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title={label}
        description={PROJECT_TYPE_DESCRIPTIONS[type]}
        icon={
          <span className="border-primary/20 bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl border">
            {headerIcon(type)}
          </span>
        }
      />

      <ProjectBrowserFilters
        category={category}
        categories={categories}
        clientRequirement={clientRequirement}
        filterCount={filterCount}
        gameVersion={gameVersion}
        hasFilters={filtersActive}
        loader={loader}
        onCategoryChange={onCategoryChange}
        onClearFilters={clearFilters}
        onClientRequirementChange={onClientRequirementChange}
        onGameVersionChange={onGameVersionChange}
        onLoaderChange={onLoaderChange}
        onQueryChange={setQuery}
        onSortChange={onSortChange}
        query={query}
        sort={sort}
        type={type}
      />

      <div className="mt-10">
        <h2 className="text-foreground text-xl font-semibold tracking-tight">
          Results
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Browse {label.toLowerCase()} from across the community.
        </p>
      </div>

      {error ? <ErrorState message={error} onRetry={retry} /> : null}

      {liveEvent ? (
        <LiveEventBanner event={liveEvent} onRefresh={refreshFromLiveEvent} />
      ) : null}

      {showSkeletons || showInitialSkeletons ? <ResultSkeletons /> : null}

      {showEmpty ? (
        <BrowseEmptyState
          filtersActive={filtersActive}
          label={label}
          onClearFilters={clearFilters}
          type={type}
        />
      ) : null}

      {showResults ? (
        <Results
          currentPage={page}
          isSearching={isSearching}
          onPageChange={setPage}
          result={result}
          totalPages={totalPages}
          type={type}
        />
      ) : null}
    </div>
  );
};

export const ProjectBrowserSkeleton = () => (
  <div
    aria-busy="true"
    className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
  >
    <Skeleton className="size-12 rounded-xl" />
    <Skeleton className="mt-4 h-9 w-64 max-w-full" />
    <Skeleton className="mt-3 h-5 w-80 max-w-full" />
    <div className="border-border bg-card mt-8 overflow-hidden rounded-xl border">
      <div className="border-border/70 bg-muted/20 border-b px-4 py-4 sm:px-6 sm:py-5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <Skeleton className="mt-5 h-12 w-full rounded-xl" />
      </div>
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
    <Skeleton className="mt-10 h-6 w-28" />
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-52 rounded-xl" />
      ))}
    </div>
  </div>
);
