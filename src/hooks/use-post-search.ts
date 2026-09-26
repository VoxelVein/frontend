import { useDebouncedValue } from "@tanstack/react-pacer/debouncer";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import type { PostSearchDocument } from "@/lib/posts-search";

/** How long typing settles before a query is sent. */
const SEARCH_DEBOUNCE_MS = 300;

interface SearchState {
  error: string | null;
  isSearching: boolean;
  hits: PostSearchDocument[] | null;
}

type SearchAction =
  | { type: "START" }
  | { type: "SUCCESS"; hits: PostSearchDocument[] }
  | { type: "CLEARED" }
  | { type: "UNAVAILABLE" }
  | { type: "ERROR"; error: string };

const searchReducer = (
  state: SearchState,
  action: SearchAction
): SearchState => {
  switch (action.type) {
    case "START": {
      return { ...state, error: null, isSearching: true };
    }
    case "SUCCESS": {
      return { error: null, isSearching: false, hits: action.hits };
    }
    case "CLEARED": {
      return { error: null, isSearching: false, hits: null };
    }
    case "UNAVAILABLE": {
      return { error: null, isSearching: false, hits: null };
    }
    case "ERROR": {
      return { ...state, error: action.error, isSearching: false };
    }
    default: {
      return state;
    }
  }
};

export interface UsePostSearchOptions {
  /**
   * Whether search is usable. `null` means "not known yet", which makes the
   * hook probe once on mount; a boolean skips the probe entirely.
   */
  availability: boolean | null;
  /** Runs one query. A response with `available: false` deactivates search. */
  fetchResults: (query: string) => Promise<{
    available: boolean;
    hits: PostSearchDocument[];
  }>;
  /**
   * Asks whether search works at all. Only consulted when `availability` is
   * `null`, so a caller that already knows the answer can omit it.
   */
  probe?: () => Promise<boolean>;
}

export interface UsePostSearchResult {
  /** The current query, which the caller binds to its input. */
  query: string;
  onQueryChange: (value: string) => void;
  /** Results for the active query; empty when no search is running. */
  hits: PostSearchDocument[];
  /** True when a query is active and search has not been deactivated. */
  isActive: boolean;
  isSearching: boolean;
  error: string | null;
  /** False once search is known to be unusable, so the field can be hidden. */
  isAvailable: boolean;
}

/**
 * Drives a blog search field over Meilisearch.
 *
 * Search is optional infrastructure, so the field only appears once it is known
 * to work and disappears again if Meilisearch goes away mid-session, rather
 * than leaving a box that quietly returns nothing.
 */
export const usePostSearch = ({
  availability,
  fetchResults,
  probe,
}: UsePostSearchOptions): UsePostSearchResult => {
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(query, {
    wait: SEARCH_DEBOUNCE_MS,
  });
  const [probed, setProbed] = useState<boolean | null>(null);
  const [isDeactivated, setIsDeactivated] = useState(false);
  const [state, dispatch] = useReducer(searchReducer, {
    error: null,
    isSearching: false,
    hits: null,
  });
  const hasMountedRef = useRef(false);
  const requestIdRef = useRef(0);
  /**
   * The trimmed query that the results on screen belong to, whether that
   * request has landed or is still in flight. Edits that trim away to this same
   * query are recognised and left alone, because nothing will be sent for them.
   */
  const sentQueryRef = useRef("");
  /** Whether the request for `sentQueryRef` is still outstanding. */
  const pendingRef = useRef(false);
  /**
   * The caller's fetch function, read through a ref so that `runSearch` keeps a
   * stable identity. Both callers pass an inline arrow, so depending on
   * `fetchResults` directly would rebuild `runSearch` on every render, re-run
   * the search effect on every render, and dispatch forever.
   */
  const fetchResultsRef = useRef(fetchResults);

  useEffect(() => {
    fetchResultsRef.current = fetchResults;
  }, [fetchResults]);

  const { error, hits, isSearching } = state;
  const trimmedQuery = debouncedQuery.trim();

  // Derived rather than stored, so a caller that already knows the answer
  // (from a loader) never triggers a state update to record it.
  const isAvailable = !isDeactivated && (availability ?? probed ?? false);

  useEffect(() => {
    if (availability !== null || !probe) {
      return;
    }

    let cancelled = false;

    const runProbe = async () => {
      try {
        const available = await probe();

        if (!cancelled) {
          setProbed(available);
        }
      } catch {
        // A failed probe just leaves the field hidden. Availability is
        // re-checked by the next search, which is where it actually matters.
        if (!cancelled) {
          setProbed(false);
        }
      }
    };

    void runProbe();

    return () => {
      cancelled = true;
    };
  }, [availability, probe]);

  // oxlint-disable-next-line react-doctor/react-compiler-no-manual-memoization -- React Compiler is not enabled in this project; useCallback keeps the effect from re-running on every render
  const runSearch = useCallback(async (value: string) => {
    const thisRequestId = requestIdRef.current;

    try {
      const data = await fetchResultsRef.current(value);

      // A newer query has already been issued; this response is stale.
      if (requestIdRef.current !== thisRequestId) {
        return;
      }

      pendingRef.current = false;

      if (!data.available) {
        setIsDeactivated(true);
        dispatch({ type: "UNAVAILABLE" });
        return;
      }

      dispatch({ hits: data.hits, type: "SUCCESS" });
    } catch (searchError) {
      if (requestIdRef.current === thisRequestId) {
        pendingRef.current = false;
        dispatch({
          error:
            searchError instanceof Error
              ? searchError.message
              : "Could not search posts.",
          type: "ERROR",
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!isAvailable) {
      return;
    }

    // Availability is settled by the probe or the loader on mount; only react
    // to real edits after that.
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    // Retiring the previous request belongs here rather than in the keystroke
    // handler: a keystroke does not yet promise a request, and abandoning a
    // search on that promise would drop the results for a query the reader may
    // still be on. From here a replacement is genuinely on its way.
    requestIdRef.current += 1;
    sentQueryRef.current = trimmedQuery;

    if (trimmedQuery.length === 0) {
      pendingRef.current = false;
      return;
    }

    pendingRef.current = true;

    // oxlint-disable-next-line react/set-state-in-effect -- This effect synchronizes with Meilisearch, an external system, and every setState inside runSearch happens after its await, so it cannot cascade a render.
    runSearch(trimmedQuery);
  }, [isAvailable, runSearch, trimmedQuery]);

  const onQueryChange = (value: string) => {
    const trimmed = value.trim();

    setQuery(value);

    // Whitespace-only edits trim away to the query already on screen, and an
    // edit that returns to it before the debounce elapses settles there too.
    // The debounced value does not move either way, so no request is issued
    // and this effect does not run: nothing raised here would be left waiting.
    if (trimmed === sentQueryRef.current) {
      // A search for exactly this query is still in flight and was never
      // abandoned, so leave it to land.
      if (pendingRef.current) {
        return;
      }

      // It already landed, so put its results back rather than leaving the
      // empty state that an intermediate keystroke replaced them with.
      if (isSearching) {
        dispatch({ hits: hits ?? [], type: "SUCCESS" });
      }

      return;
    }

    // Clearing is the one edit that has to retire a search immediately: waiting
    // out the debounce would let a late response repopulate a field the reader
    // has just emptied.
    if (trimmed.length === 0) {
      requestIdRef.current += 1;
      pendingRef.current = false;
    }

    // The busy state is raised here, at the keystroke that caused it, rather
    // than inside the effect that issues the request: the reader should see
    // that a search is under way immediately, not after the debounce.
    dispatch({ type: trimmed.length === 0 ? "CLEARED" : "START" });
  };

  return {
    error,
    hits: hits ?? [],
    isActive: isAvailable && trimmedQuery.length > 0,
    isAvailable,
    isSearching,
    onQueryChange,
    query,
  };
};
