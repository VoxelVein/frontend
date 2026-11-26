import { useDebouncedValue } from "@tanstack/react-pacer/debouncer";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import {
  activeFilterCount,
  buildSearchParams,
  DEFAULT_SORT,
  hasActiveFilters,
  parseLiveEvent,
  SEARCH_DEBOUNCE_MS,
  totalPagesFor,
} from "@/lib/project-browser";
import type { LiveModEvent } from "@/lib/project-browser";
import { toSearchErrorMessage } from "@/lib/project-browser-loader";
import type { ProjectBrowserData } from "@/lib/project-browser-loader";
import { projectSearchCache } from "@/lib/project-search-cache";
import { searchProjects } from "@/lib/project-search.functions";
import type {
  ProjectSearchParams,
  ProjectSearchResponse,
} from "@/lib/project-search.functions";
import { CATEGORIES_BY_TYPE } from "@/lib/projects";
import type { ProjectType } from "@/lib/projects";

// SAFETY: Vite exposes VITE_* vars as `any`; narrowing to string | undefined
// matches the runtime value (string when set, undefined when absent). Local
// development uses the same-origin Vite proxy; production connects directly to
// the configured public API and never falls back to the visitor's localhost.
const API_URL = import.meta.env.DEV
  ? ""
  : (import.meta.env.VITE_API_URL as string | undefined);

const noEventCleanup = (): void => {
  // No EventSource exists when the API URL is not configured.
};

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

export interface UseProjectBrowserOptions {
  initial: ProjectBrowserData["initial"];
  initialError: ProjectBrowserData["initialError"];
  type: ProjectType;
}

/**
 * Search, filter, cache and live-event state for one browse page.
 *
 * The page component used to own all of this alongside its markup, which made
 * one function both the state machine and the layout. The hook has no JSX, so
 * the request rules can be read (and changed) without scrolling past cards.
 */
export const useProjectBrowser = ({
  initial,
  initialError,
  type,
}: UseProjectBrowserOptions) => {
  const [query, setQuery] = useState("");

  const [debouncedQuery] = useDebouncedValue(query, {
    wait: SEARCH_DEBOUNCE_MS,
  });

  const [category, setCategory] = useState("");
  const [gameVersion, setGameVersion] = useState("");
  const [loader, setLoader] = useState("");
  const [clientRequirement, setClientRequirement] = useState("");
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

  const categories = [
    ...new Set([
      ...CATEGORIES_BY_TYPE[type],
      ...Object.keys(result?.facetDistribution?.category ?? {}),
      ...(category ? [category] : []),
    ]),
  ];

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

    runSearch(
      buildSearchParams({
        category,
        clientRequirement,
        gameVersion,
        loader,
        page,
        sort,
        type,
        query: debouncedQuery,
      })
    );
  }, [
    category,
    clientRequirement,
    debouncedQuery,
    gameVersion,
    loader,
    page,
    runSearch,
    sort,
    type,
  ]);

  useEffect(() => {
    if (API_URL === undefined) {
      return noEventCleanup;
    }

    const source = new EventSource(`${API_URL}/api/events`);

    // A dropped stream is silent by design: browsing, filtering and searching
    // all still work, and EventSource reconnects on its own. Infrastructure
    // warnings belong on the admin dashboard, not in a public user's toast.
    const handleEvent = (event: MessageEvent) => {
      const parsed = parseLiveEvent(String(event.data));

      if (parsed) {
        setLiveEvent(parsed);
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

  const filters = {
    category,
    clientRequirement,
    gameVersion,
    loader,
    query,
  };

  const filtersActive = hasActiveFilters(filters);
  const filterCount = activeFilterCount(filters);
  const totalPages = totalPagesFor(result);

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setGameVersion("");
    setLoader("");
    setClientRequirement("");
    setPage(1);
    dispatch({ type: "SEARCH_START" });
  };

  const retry = () => {
    dispatch({ type: "RETRY" });
    runSearch(
      buildSearchParams({
        category,
        clientRequirement,
        gameVersion,
        loader,
        page,
        query,
        sort,
        type,
      })
    );
  };

  const refreshFromLiveEvent = () => {
    setLiveEvent(null);

    const params = buildSearchParams({
      category,
      clientRequirement,
      gameVersion,
      loader,
      page,
      query,
      sort,
      type,
    });

    projectSearchCache.delete(params);
    runSearch(params);
  };

  const changeFilter =
    (setter: (value: string) => void) => (value: string | null) => {
      setter(value ?? "");
      setPage(1);
      dispatch({ type: "SEARCH_START" });
    };

  return {
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
    page,
    query,
    refreshFromLiveEvent,
    result,
    retry,
    setPage,
    setQuery,
    sort,
    totalPages,
    onCategoryChange: changeFilter(setCategory),
    onClientRequirementChange: changeFilter(setClientRequirement),
    onGameVersionChange: changeFilter(setGameVersion),
    onLoaderChange: changeFilter(setLoader),
    onSortChange: changeFilter(setSort),
  };
};
