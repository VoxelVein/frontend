import {
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconSearchOff,
  IconX,
} from "@tabler/icons-react";
import { useDebouncedValue } from "@tanstack/react-pacer/debouncer";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toSearchErrorMessage } from "@/lib/project-browser-loader";
import type { ProjectBrowserData } from "@/lib/project-browser-loader";
import { projectSearchCache } from "@/lib/project-search-cache";
import { searchProjects } from "@/lib/project-search.functions";
import type {
  ProjectSearchParams,
  ProjectSearchResponse,
} from "@/lib/project-search.functions";
import {
  CATEGORIES_BY_TYPE,
  GAME_VERSIONS,
  LOADERS_BY_TYPE,
  PROJECT_TYPE_LABELS,
} from "@/lib/projects";
import type { ProjectType } from "@/lib/projects";

const DEFAULT_SORT = "downloads:desc";

const DEV_API_URL = "http://localhost:3002";

// SAFETY: Vite exposes VITE_* vars as `any`; narrowing to string | undefined
// matches the runtime value (string when set, undefined when absent).
// VITE_API_URL is inlined at build time. Only dev builds fall back to the
// local API; a production build without it gets no live updates rather than
// connecting to the visitor's own machine. The Docker build refuses to run
// without it.
const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? DEV_API_URL : undefined);

interface LiveModEventData {
  id: string;
  name: string;
}

interface LiveModEvent {
  event: "mod.created" | "mod.updated" | "mod.deleted";
  data: LiveModEventData;
}

const LIVE_EVENT_LABELS = {
  "mod.created": "New mod added",
  "mod.deleted": "Mod removed",
  "mod.updated": "Mod updated",
} as const satisfies Record<LiveModEvent["event"], string>;

const SORT_OPTIONS = [
  { label: "Most downloaded", value: DEFAULT_SORT },
  { label: "Recently updated", value: "updatedAt:desc" },
  { label: "Name (A–Z)", value: "name:asc" },
] as const;

const SearchBar = ({
  query,
  onQueryChange,
  type,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  type: ProjectType;
}) => (
  <div className="relative mt-8">
    <IconSearch
      size={18}
      stroke={1.8}
      aria-hidden="true"
      className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
    />
    <label className="sr-only" htmlFor={`${type}-search`}>
      Search {PROJECT_TYPE_LABELS[type].plural.toLowerCase()}
    </label>
    <input
      id={`${type}-search`}
      name="query"
      type="search"
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
      placeholder={`Search ${PROJECT_TYPE_LABELS[type].plural.toLowerCase()}…`}
      autoComplete="off"
      className="border-border bg-muted/40 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus:bg-background min-h-12 w-full rounded-xl border pr-12 pl-11 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none"
    />
    {query ? (
      <button
        type="button"
        onClick={() => onQueryChange("")}
        aria-label="Clear search"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
      >
        <IconX size={16} aria-hidden="true" />
      </button>
    ) : null}
  </div>
);

interface FiltersProps {
  category: string;
  gameVersion: string;
  loader: string;
  onCategoryChange: (value: string | null) => void;
  onGameVersionChange: (value: string | null) => void;
  onLoaderChange: (value: string | null) => void;
  onSortChange: (value: string | null) => void;
  sort: string;
  type: ProjectType;
}

const ALL_LOADERS_LABELS = {
  mod: "All loaders",
  plugin: "All platforms",
} as const satisfies Record<ProjectType, string>;

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).replaceAll("-", " ");

const Filters = ({
  category,
  gameVersion,
  loader,
  onCategoryChange,
  onGameVersionChange,
  onLoaderChange,
  onSortChange,
  sort,
  type,
}: FiltersProps) => (
  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <div>
      <label className="sr-only" htmlFor={`${type}-category`}>
        Category
      </label>
      <Select
        items={[
          { label: "All categories", value: "" },
          ...CATEGORIES_BY_TYPE[type].map((value) => ({
            label: capitalize(value),
            value,
          })),
        ]}
        value={category}
        onValueChange={onCategoryChange}
      >
        <SelectTrigger id={`${type}-category`} className="min-h-11 w-full">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All categories</SelectItem>
          {CATEGORIES_BY_TYPE[type].map((value) => (
            <SelectItem key={value} value={value}>
              {capitalize(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div>
      <label className="sr-only" htmlFor={`${type}-game-version`}>
        Game version
      </label>
      <Select
        items={[
          { label: "All versions", value: "" },
          ...GAME_VERSIONS.map((value) => ({
            label: `Minecraft ${value}`,
            value,
          })),
        ]}
        value={gameVersion}
        onValueChange={onGameVersionChange}
      >
        <SelectTrigger id={`${type}-game-version`} className="min-h-11 w-full">
          <SelectValue placeholder="All versions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All versions</SelectItem>
          {GAME_VERSIONS.map((value) => (
            <SelectItem key={value} value={value}>
              Minecraft {value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div>
      <label className="sr-only" htmlFor={`${type}-loader`}>
        {type === "mod" ? "Loader" : "Platform"}
      </label>
      <Select
        items={[
          { label: ALL_LOADERS_LABELS[type], value: "" },
          ...LOADERS_BY_TYPE[type].map((value) => ({
            label: capitalize(value),
            value,
          })),
        ]}
        value={loader}
        onValueChange={onLoaderChange}
      >
        <SelectTrigger id={`${type}-loader`} className="min-h-11 w-full">
          <SelectValue placeholder={ALL_LOADERS_LABELS[type]} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{ALL_LOADERS_LABELS[type]}</SelectItem>
          {LOADERS_BY_TYPE[type].map((value) => (
            <SelectItem key={value} value={value}>
              {capitalize(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div>
      <label className="sr-only" htmlFor={`${type}-sort`}>
        Sort by
      </label>
      <Select items={SORT_OPTIONS} value={sort} onValueChange={onSortChange}>
        <SelectTrigger id={`${type}-sort`} className="min-h-11 w-full">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Search state managed via useReducer — consolidates result, error, and
// isSearching that were previously three separate useState hooks.
// ---------------------------------------------------------------------------

interface SearchState {
  result: ProjectSearchResponse | null;
  error: string | null;
  isSearching: boolean;
}

type SearchAction =
  | { type: "SEARCH_START" }
  | { type: "SEARCH_SUCCESS"; payload: ProjectSearchResponse }
  | { type: "SEARCH_ERROR"; payload: string }
  | { type: "RETRY" };

const searchReducer = (
  state: SearchState,
  action: SearchAction
): SearchState => {
  switch (action.type) {
    case "SEARCH_START": {
      return { ...state, error: null, isSearching: true };
    }
    case "SEARCH_SUCCESS": {
      return { error: null, isSearching: false, result: action.payload };
    }
    case "SEARCH_ERROR": {
      return { ...state, error: action.payload, isSearching: false };
    }
    case "RETRY": {
      return { error: null, isSearching: true, result: null };
    }
    default: {
      return state;
    }
  }
};

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

const LiveEventBanner = ({ event, onRefresh }: LiveEventBannerProps) => (
  <output className="border-primary/30 bg-primary/5 text-foreground mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm">
    <span>
      {LIVE_EVENT_LABELS[event.event]}: {event.data.name}
    </span>
    <button
      type="button"
      onClick={onRefresh}
      className="text-primary focus-visible:ring-ring min-h-11 rounded-lg px-3 text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
    >
      Refresh results
    </button>
  </output>
);

const ResultSkeletons = () => (
  <div
    aria-busy="true"
    className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
  >
    {Array.from({ length: 6 }, (_, index) => (
      <Skeleton key={index} className="h-52 rounded-2xl" />
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

const Results = ({
  currentPage,
  isSearching,
  onPageChange,
  result,
  totalPages,
  type,
}: ResultsProps) => (
  <>
    <p className="text-muted-foreground mt-8 text-sm" aria-live="polite">
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
        <li key={project.id}>
          <ProjectCard project={project} />
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

const PAGE_DESCRIPTIONS = {
  mod: "Discover performance, technology, adventure, and more — search Minecraft mods.",
  plugin:
    "Find administration, economy, protection, and minigame plugins for Minecraft servers.",
} as const satisfies Record<ProjectType, string>;

interface ProjectBrowserProps extends ProjectBrowserData {
  type: ProjectType;
}

// oxlint-disable-next-line eslint/complexity -- ProjectBrowser conditionally renders search, filters, skeleton, empty, results, and pagination states; extracting further would fragment the page logic
export const ProjectBrowser = ({
  initial,
  initialError,
  type,
}: ProjectBrowserProps) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query, { wait: 300 });
  const [category, setCategory] = useState("");
  const [gameVersion, setGameVersion] = useState("");
  const [loader, setLoader] = useState("");
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [liveEvent, setLiveEvent] = useState<LiveModEvent | null>(null);
  const [state, dispatch] = useReducer(searchReducer, {
    error: initialError,
    isSearching: false,
    result: initial,
  });
  const hasMountedRef = useRef(false);
  const requestIdRef = useRef(0);

  const { result, error, isSearching } = state;

  // oxlint-disable-next-line react-doctor/react-compiler-no-manual-memoization -- React Compiler is not enabled in this project; useCallback keeps runSearch stable so the search effect does not re-run on every render
  const runSearch = useCallback(async (params: ProjectSearchParams) => {
    requestIdRef.current += 1;
    const thisRequestId = requestIdRef.current;
    dispatch({ type: "SEARCH_START" });

    const cached = projectSearchCache.get(params);
    if (cached) {
      if (requestIdRef.current === thisRequestId) {
        dispatch({ payload: cached, type: "SEARCH_SUCCESS" });
      }
      return;
    }

    try {
      const data = await searchProjects({ data: params });
      projectSearchCache.set(params, data);

      if (requestIdRef.current === thisRequestId) {
        dispatch({ payload: data, type: "SEARCH_SUCCESS" });
      }
    } catch (searchError) {
      if (requestIdRef.current === thisRequestId) {
        dispatch({
          payload: toSearchErrorMessage(searchError),
          type: "SEARCH_ERROR",
        });
      }
    }
  }, []);

  useEffect(() => {
    // The loader already fetched the default search on the server; skip the
    // mount-time run so the initial data is not re-fetched on the client.
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    runSearch({
      category,
      gameVersion,
      loader,
      page,
      query: debouncedQuery,
      sort,
      type,
    });
  }, [
    category,
    debouncedQuery,
    gameVersion,
    loader,
    page,
    runSearch,
    sort,
    type,
  ]);

  useEffect(() => {
    if (!API_URL) {
      return;
    }
    const source = new EventSource(`${API_URL}/api/events`);

    const handleEvent = (event: MessageEvent) => {
      try {
        // SAFETY: The event stream is produced by our own webhook endpoint,
        // which validates the payload shape before broadcasting.
        setLiveEvent(JSON.parse(event.data) as LiveModEvent);
      } catch {
        // Ignore malformed events from the stream.
      }
    };

    source.addEventListener("mod.created", handleEvent);
    source.addEventListener("mod.updated", handleEvent);
    source.addEventListener("mod.deleted", handleEvent);

    return () => {
      source.removeEventListener("mod.created", handleEvent);
      source.removeEventListener("mod.updated", handleEvent);
      source.removeEventListener("mod.deleted", handleEvent);
      source.close();
    };
  }, []);

  const hasFilters = Boolean(category || gameVersion || loader || query);
  const showSkeletons = isSearching && !result && !error;
  const showEmpty =
    !isSearching && !error && result && result.hits.length === 0;
  const showResults =
    !isSearching && !error && result && result.hits.length > 0;
  // If the loader returned no data and no error (e.g. first paint before the
  // client search resolves), keep skeletons visible instead of a blank page.
  const showInitialSkeletons = !isSearching && !error && !result;

  const totalPages = result
    ? Math.max(1, Math.ceil(result.estimatedTotalHits / result.pageSize))
    : 1;

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setGameVersion("");
    setLoader("");
    setPage(1);
    dispatch({ type: "SEARCH_START" });
  };

  const retry = () => {
    dispatch({ type: "RETRY" });
    runSearch({
      category,
      gameVersion,
      loader,
      page,
      query,
      sort,
      type,
    });
  };

  const refreshFromLiveEvent = () => {
    setLiveEvent(null);
    const params = { category, gameVersion, loader, page, query, sort, type };
    projectSearchCache.delete(params);
    runSearch(params);
  };

  const changeFilter =
    (setter: (value: string) => void) => (value: string | null) => {
      setter(value ?? "");
      setPage(1);
      dispatch({ type: "SEARCH_START" });
    };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <PageHeader
        title={PROJECT_TYPE_LABELS[type].plural}
        description={PAGE_DESCRIPTIONS[type]}
      />

      <SearchBar query={query} onQueryChange={setQuery} type={type} />

      <Filters
        category={category}
        gameVersion={gameVersion}
        loader={loader}
        onCategoryChange={changeFilter(setCategory)}
        onGameVersionChange={changeFilter(setGameVersion)}
        onLoaderChange={changeFilter(setLoader)}
        onSortChange={changeFilter(setSort)}
        sort={sort}
        type={type}
      />

      {error ? <ErrorState message={error} onRetry={retry} /> : null}

      {liveEvent ? (
        <LiveEventBanner event={liveEvent} onRefresh={refreshFromLiveEvent} />
      ) : null}

      {showSkeletons || showInitialSkeletons ? <ResultSkeletons /> : null}

      {showEmpty ? (
        <EmptyState
          icon={<IconSearchOff size={24} aria-hidden="true" />}
          title={`No ${PROJECT_TYPE_LABELS[type].plural.toLowerCase()} found`}
          description="Try a different search or clear your filters."
          action={
            hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="text-primary focus-visible:ring-ring mt-4 min-h-11 rounded-lg px-3 text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                Clear filters
              </button>
            ) : null
          }
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
    className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8"
  >
    <Skeleton className="h-9 w-32" />
    <Skeleton className="mt-3 h-5 w-72 max-w-full" />
    <Skeleton className="mt-8 h-12 w-full rounded-xl" />
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-52 rounded-2xl" />
      ))}
    </div>
  </div>
);
