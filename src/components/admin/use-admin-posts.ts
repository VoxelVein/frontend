import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { usePostSearch } from "@/hooks/use-post-search";
import type { Post, PostSummary } from "@/lib/posts";
import {
  deletePost,
  getPostById,
  listPosts,
  postSearchAvailable,
  searchPostsAdmin,
} from "@/lib/posts.functions";

/** How often the Posts tab refreshes itself while the tab is visible. */
const POLL_INTERVAL_MS = 15_000;

interface PostsState {
  error: string | null;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  posts: PostSummary[];
}

type PostsAction =
  | { type: "LOAD_START" }
  | { type: "REFRESH_START" }
  | { type: "LOAD_SUCCESS"; posts: PostSummary[] }
  | { type: "CREATE_SUCCESS"; post: Post }
  | { type: "UPDATE_SUCCESS"; post: Post }
  | { type: "DELETE_SUCCESS"; id: string }
  | { type: "ERROR"; error: string };

const initialState: PostsState = {
  error: null,
  isInitialLoading: true,
  isRefreshing: false,
  posts: [],
};

const postsReducer = (state: PostsState, action: PostsAction): PostsState => {
  switch (action.type) {
    case "LOAD_START": {
      return { ...state, error: null, isInitialLoading: true };
    }
    case "REFRESH_START": {
      return { ...state, isRefreshing: true };
    }
    case "LOAD_SUCCESS": {
      return {
        ...state,
        error: null,
        isInitialLoading: false,
        isRefreshing: false,
        posts: action.posts,
      };
    }
    case "CREATE_SUCCESS": {
      return { ...state, error: null, posts: [action.post, ...state.posts] };
    }
    case "UPDATE_SUCCESS": {
      return {
        ...state,
        error: null,
        posts: state.posts.map((post) =>
          post.id === action.post.id ? action.post : post
        ),
      };
    }
    case "DELETE_SUCCESS": {
      return {
        ...state,
        error: null,
        posts: state.posts.filter((post) => post.id !== action.id),
      };
    }
    case "ERROR": {
      return { ...state, error: action.error };
    }
    default: {
      return state;
    }
  }
};

/** An error caused by the posts table being absent needs its own wording. */
const toLoadError = (cause: unknown) => {
  if (!(cause instanceof Error)) {
    return "Could not load posts.";
  }

  return cause.message.includes("Failed query")
    ? "Posts table not found. Run the database migration first."
    : cause.message;
};

const toMessage = (cause: unknown, fallback: string) => {
  if (!(cause instanceof Error)) {
    return fallback;
  }

  return cause.message;
};

/**
 * The post fields a row in the Posts tab renders. `PostSummary` (from the
 * database) and `PostSearchDocument` (from Meilisearch) both satisfy it, so
 * search hits and list entries render through the same row.
 */
export interface AdminPostRow {
  createdAt: Date | string;
  excerpt: string | null;
  id: string;
  preview: string;
  published: boolean;
  slug: string;
  title: string;
  updatedAt: Date | string;
}

export interface UseAdminPostsResult {
  error: string | null;
  isInitialLoading: boolean;
  isMutating: boolean;
  isRefreshing: boolean;
  isSearching: boolean;
  /** Loads the full post behind a summary, for the edit dialog. */
  loadPostForEdit: (post: PostSummary) => Promise<Post | null>;
  onCreated: (post: Post) => void;
  onQueryChange: (value: string) => void;
  onUpdated: (post: Post) => void;
  posts: AdminPostRow[];
  query: string;
  removePost: (post: PostSummary) => Promise<void>;
  reportError: (error: string) => void;
  searchAvailable: boolean;
}

/**
 * Owns the Posts tab's data: the initial load, background refresh, and search.
 *
 * Refresh runs on a timer rather than behind a button, so everything in this
 * tab has to stay usable while it happens: a background refresh never shows a
 * loading state, never reports an error, and never overwrites a save that
 * landed while its request was in flight.
 */
export const useAdminPosts = (): UseAdminPostsResult => {
  const [state, dispatch] = useReducer(postsReducer, initialState);
  const [isMutating, setIsMutating] = useState(false);
  const loadInFlightRef = useRef(false);
  /** Bumped by every mutation so a concurrent load can detect it went stale. */
  const mutationCountRef = useRef(0);

  const { error, isInitialLoading, isRefreshing, posts } = state;

  const loadPosts = useCallback(async (background: boolean) => {
    // Overlapping loads can resolve out of order and leave the list stale.
    if (loadInFlightRef.current) {
      return;
    }

    loadInFlightRef.current = true;
    const mutationsAtStart = mutationCountRef.current;
    dispatch({ type: background ? "REFRESH_START" : "LOAD_START" });

    try {
      const rows = await listPosts({ data: { includeUnpublished: true } });

      // A refresh that began before a save completed would resolve with the
      // pre-save list and silently drop the change the admin just made.
      if (mutationsAtStart === mutationCountRef.current) {
        dispatch({ posts: rows, type: "LOAD_SUCCESS" });
      }
    } catch (loadError) {
      // The list already on screen beats interrupting the admin with an error
      // for a refresh they never asked for.
      if (!background) {
        dispatch({ error: toLoadError(loadError), type: "ERROR" });
      }
    }

    loadInFlightRef.current = false;
  }, []);

  useEffect(() => {
    void loadPosts(false);
  }, [loadPosts]);

  useEffect(() => {
    const tick = () => {
      // Polling a hidden tab burns requests on a page nobody is looking at.
      if (document.visibilityState === "hidden") {
        return;
      }

      void loadPosts(true);
    };

    const interval = setInterval(tick, POLL_INTERVAL_MS);

    // A tab left in the background for an hour misses every tick, so catch up
    // the moment it becomes visible again.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadPosts]);

  const {
    error: searchError,
    hits,
    isActive,
    isAvailable,
    isSearching,
    onQueryChange,
    query,
  } = usePostSearch({
    availability: null,
    fetchResults: (value) => searchPostsAdmin({ data: { query: value } }),
    probe: postSearchAvailable,
  });

  const onCreated = (post: Post) => {
    // Bumped like every other mutation, so a refresh already in flight
    // recognises that the list it is fetching has been superseded.
    mutationCountRef.current += 1;
    dispatch({ post, type: "CREATE_SUCCESS" });
  };

  const onUpdated = (post: Post) => {
    mutationCountRef.current += 1;
    dispatch({ post, type: "UPDATE_SUCCESS" });
  };

  /** Loads the full post for editing, since the list only carries summaries. */
  const loadPostForEdit = async (post: PostSummary): Promise<Post | null> => {
    setIsMutating(true);
    let loaded: Post | null = null;

    try {
      loaded = await getPostById({ data: { id: post.id } });
    } catch (editError) {
      dispatch({
        error: toMessage(editError, "Could not load the post."),
        type: "ERROR",
      });
    }

    setIsMutating(false);

    return loaded;
  };

  const removePost = async (post: PostSummary) => {
    mutationCountRef.current += 1;
    setIsMutating(true);

    try {
      await deletePost({ data: { id: post.id } });
      dispatch({ id: post.id, type: "DELETE_SUCCESS" });
    } catch (deleteError) {
      dispatch({
        error: toMessage(deleteError, "Could not delete the post."),
        type: "ERROR",
      });
    }

    setIsMutating(false);
  };

  return {
    error: error ?? searchError,
    isInitialLoading,
    isMutating,
    isRefreshing,
    isSearching,
    loadPostForEdit,
    onCreated,
    onQueryChange,
    onUpdated,
    posts: isActive ? hits : posts,
    query,
    removePost,
    reportError: (loadError: string) =>
      dispatch({ error: loadError, type: "ERROR" }),
    searchAvailable: isAvailable,
  };
};
