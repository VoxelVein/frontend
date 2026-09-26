import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAdminPosts } from "@/components/admin/use-admin-posts";
import type { Post, PostSummary } from "@/lib/posts";
import type { PostSearchDocument } from "@/lib/posts-search";

const {
  deletePostMock,
  getPostByIdMock,
  listPostsMock,
  postSearchAvailableMock,
  searchPostsAdminMock,
} = vi.hoisted(() => ({
  deletePostMock: vi.fn<(opts: { data: { id: string } }) => Promise<void>>(),
  getPostByIdMock:
    vi.fn<(opts: { data: { id: string } }) => Promise<Post | null>>(),
  listPostsMock: vi.fn<(opts: { data: object }) => Promise<PostSummary[]>>(),
  postSearchAvailableMock: vi.fn<() => Promise<boolean>>(),
  searchPostsAdminMock: vi.fn<
    (opts: { data: { query: string } }) => Promise<{
      available: boolean;
      estimatedTotalHits: number;
      hits: PostSearchDocument[];
      query: string;
    }>
  >(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The hook talks to server functions; string paths avoid strict factory type-checking against the server function types
vi.mock("@/lib/posts.functions", () => ({
  deletePost: deletePostMock,
  getPostById: getPostByIdMock,
  listPosts: listPostsMock,
  postSearchAvailable: postSearchAvailableMock,
  searchPostsAdmin: searchPostsAdminMock,
}));

const POLL_INTERVAL_MS = 15_000;

const summary = (id: string, title: string): PostSummary => ({
  createdAt: "2026-01-15T10:30:00.000Z",
  excerpt: null,
  id,
  preview: `Preview of ${title}.`,
  published: true,
  slug: id,
  title,
  updatedAt: "2026-01-15T10:30:00.000Z",
});

/** A saved post, as the create and update callbacks receive it. */
const saved = (id: string, title: string): Post => ({
  ...summary(id, title),
  authorId: "author-1",
  content: `Body of ${title}.`,
});

/**
 * Flushes pending microtasks and timers.
 *
 * `waitFor` cannot be used here: it schedules its own real-time polling, which
 * never advances while fake timers are installed.
 */
const settle = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const setVisibility = (state: "hidden" | "visible") => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
};

/**
 * Waits out the search debounce in real time, so a case can assert on the
 * settled state rather than on the instant the keystroke was handled.
 */
const waitOutDebounce = async () => {
  // oxlint-disable-next-line promise/avoid-new -- Deliberate real-time delay; the pacer debouncer's timers do not settle under advanceTimersByTimeAsync.
  const elapsed = new Promise((resolve) => {
    setTimeout(resolve, 500);
  });

  await act(async () => {
    await elapsed;
  });
};

/** Lets a test decide when an in-flight refresh settles. */
interface HeldRefresh {
  resolve: (rows: PostSummary[]) => void;
}

/**
 * Declared at module scope because the placeholder resolver deliberately
 * captures nothing, and each test overwrites it before use.
 */
const heldRefresh: HeldRefresh = { resolve: () => {} };

const draftHit: PostSearchDocument = {
  content: "Draft body.",
  createdAt: "2026-02-01T09:00:00.000Z",
  createdAtTs: Date.parse("2026-02-01T09:00:00.000Z"),
  excerpt: null,
  id: "draft-1",
  preview: "Preview of the draft.",
  published: false,
  slug: "draft",
  title: "Draft post",
  updatedAt: "2026-02-01T09:00:00.000Z",
};

describe(useAdminPosts, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
    deletePostMock.mockReset().mockResolvedValue();
    getPostByIdMock.mockReset();
    listPostsMock.mockReset().mockResolvedValue([summary("a", "Alpha")]);
    postSearchAvailableMock.mockReset().mockResolvedValue(true);
    searchPostsAdminMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads the posts on mount", async () => {
    const { result } = renderHook(() => useAdminPosts());
    await settle();

    expect(result.current.posts).toHaveLength(1);
    expect(listPostsMock).toHaveBeenCalledOnce();
  });

  it("refreshes in the background every 15 seconds", async () => {
    renderHook(() => useAdminPosts());
    await settle();

    await settle(POLL_INTERVAL_MS);

    expect(listPostsMock).toHaveBeenCalledTimes(2);
  });

  it("does not show a loading state while a background refresh runs", async () => {
    const { result } = renderHook(() => useAdminPosts());
    await settle();

    expect(result.current.isInitialLoading).toBeFalsy();
    await settle(POLL_INTERVAL_MS);

    // The list stays populated throughout, so nothing on screen is replaced.
    expect(result.current.isInitialLoading).toBeFalsy();
    expect(result.current.posts).toHaveLength(1);
  });

  it("does not report an error when a background refresh fails", async () => {
    const { result } = renderHook(() => useAdminPosts());
    await settle();

    listPostsMock.mockRejectedValue(new Error("network down"));
    await settle(POLL_INTERVAL_MS);

    // A refresh the admin never asked for must not interrupt them.
    expect(result.current.error).toBeNull();
    expect(result.current.posts).toHaveLength(1);
  });

  it("does not refresh while the tab is hidden", async () => {
    renderHook(() => useAdminPosts());
    await settle();

    setVisibility("hidden");
    await settle(POLL_INTERVAL_MS * 3);

    expect(listPostsMock).toHaveBeenCalledOnce();
  });

  it("catches up as soon as the tab becomes visible again", async () => {
    renderHook(() => useAdminPosts());
    await settle();

    setVisibility("hidden");
    await settle(POLL_INTERVAL_MS * 3);
    setVisibility("visible");
    await settle();

    expect(listPostsMock).toHaveBeenCalledTimes(2);
  });

  it("does not let a stale refresh undo a save", async () => {
    const { result } = renderHook(() => useAdminPosts());
    await settle();

    // A refresh that starts before a delete finishes resolves with the
    // pre-delete list, which would put the deleted post back on screen.
    // oxlint-disable-next-line promise/avoid-new -- The point of this case is a refresh that is still in flight, so the test has to decide when it settles.
    const inFlightRefresh = new Promise<PostSummary[]>((resolve) => {
      heldRefresh.resolve = resolve;
    });
    listPostsMock.mockReturnValueOnce(inFlightRefresh);

    await settle(POLL_INTERVAL_MS);
    expect(listPostsMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await result.current.removePost(summary("a", "Alpha"));
    });

    heldRefresh.resolve([summary("a", "Alpha")]);
    await settle();

    // The delete stands; the late refresh is discarded.
    expect(result.current.posts).toHaveLength(0);
  });

  it("does not let a stale refresh undo a create", async () => {
    const { result } = renderHook(() => useAdminPosts());
    await settle();

    // A refresh that starts before the create finishes resolves with a list
    // that does not contain the new post, which would make it disappear.
    // oxlint-disable-next-line promise/avoid-new -- The point of this case is a refresh that is still in flight, so the test has to decide when it settles.
    const inFlightRefresh = new Promise<PostSummary[]>((resolve) => {
      heldRefresh.resolve = resolve;
    });
    listPostsMock.mockReturnValueOnce(inFlightRefresh);

    await settle(POLL_INTERVAL_MS);
    expect(listPostsMock).toHaveBeenCalledTimes(2);

    act(() => {
      result.current.onCreated(saved("b", "Beta"));
    });

    heldRefresh.resolve([summary("a", "Alpha")]);
    await settle();

    // The new post stands; the late refresh is discarded.
    expect(result.current.posts).toHaveLength(2);
    expect(result.current.posts[0]?.title).toBe("Beta");
  });

  it("does not let a stale refresh undo an update", async () => {
    const { result } = renderHook(() => useAdminPosts());
    await settle();

    // A refresh that starts before the edit finishes resolves with the
    // pre-edit row, which would put the old title back on screen.
    // oxlint-disable-next-line promise/avoid-new -- The point of this case is a refresh that is still in flight, so the test has to decide when it settles.
    const inFlightRefresh = new Promise<PostSummary[]>((resolve) => {
      heldRefresh.resolve = resolve;
    });
    listPostsMock.mockReturnValueOnce(inFlightRefresh);

    await settle(POLL_INTERVAL_MS);
    expect(listPostsMock).toHaveBeenCalledTimes(2);

    act(() => {
      result.current.onUpdated(saved("a", "Alpha renamed"));
    });

    heldRefresh.resolve([summary("a", "Alpha")]);
    await settle();

    // The edit stands; the late refresh is discarded.
    expect(result.current.posts).toHaveLength(1);
    expect(result.current.posts[0]?.title).toBe("Alpha renamed");
  });
});

/**
 * Search runs on the pacer debouncer, whose timers do not settle under
 * `advanceTimersByTimeAsync`, so these cases use real time and `waitFor`.
 * Nothing here depends on the 15s refresh, which is far longer than the wait.
 */
describe("useAdminPosts search", () => {
  beforeEach(() => {
    deletePostMock.mockReset().mockResolvedValue();
    getPostByIdMock.mockReset();
    listPostsMock.mockReset().mockResolvedValue([summary("a", "Alpha")]);
    postSearchAvailableMock.mockReset().mockResolvedValue(true);
    searchPostsAdminMock.mockReset();
  });

  it("hides the search field when Meilisearch is unavailable", async () => {
    postSearchAvailableMock.mockResolvedValue(false);

    const { result } = renderHook(() => useAdminPosts());

    await waitFor(() => {
      expect(result.current.searchAvailable).toBeFalsy();
    });
  });

  it("searches drafts through the admin path", async () => {
    searchPostsAdminMock.mockResolvedValue({
      available: true,
      estimatedTotalHits: 1,
      hits: [draftHit],
      query: "draft",
    });

    const { result } = renderHook(() => useAdminPosts());

    await waitFor(() => {
      expect(result.current.searchAvailable).toBeTruthy();
    });

    act(() => {
      result.current.onQueryChange("draft");
    });

    await waitFor(() => {
      expect(searchPostsAdminMock).toHaveBeenCalledWith({
        data: { query: "draft" },
      });
    });
    await waitFor(() => {
      expect(result.current.posts).toHaveLength(1);
    });
    expect(result.current.posts[0]?.title).toBe("Draft post");
  });

  it("falls back to the loaded list when the query is cleared", async () => {
    searchPostsAdminMock.mockResolvedValue({
      available: true,
      estimatedTotalHits: 1,
      hits: [draftHit],
      query: "draft",
    });

    const { result } = renderHook(() => useAdminPosts());
    await waitFor(() => {
      expect(result.current.searchAvailable).toBeTruthy();
    });

    act(() => {
      result.current.onQueryChange("draft");
    });
    await waitFor(() => {
      expect(searchPostsAdminMock).toHaveBeenCalledWith({
        data: { query: "draft" },
      });
    });
    await waitFor(() => {
      expect(result.current.posts[0]?.title).toBe("Draft post");
    });

    act(() => {
      result.current.onQueryChange("");
    });
    await waitFor(() => {
      expect(result.current.posts[0]?.title).toBe("Alpha");
    });
  });

  it("does not re-search or stay busy when a trailing space is typed", async () => {
    searchPostsAdminMock.mockResolvedValue({
      available: true,
      estimatedTotalHits: 1,
      hits: [draftHit],
      query: "draft",
    });

    const { result } = renderHook(() => useAdminPosts());
    await waitFor(() => {
      expect(result.current.searchAvailable).toBeTruthy();
    });

    act(() => {
      result.current.onQueryChange("draft");
    });
    await waitFor(() => {
      expect(searchPostsAdminMock).toHaveBeenCalledWith({
        data: { query: "draft" },
      });
    });
    await waitFor(() => {
      expect(result.current.posts[0]?.title).toBe("Draft post");
    });

    // The trimmed query is unchanged, so the debounced value never moves and
    // no request is issued. Abandoning the settled search or raising the busy
    // state here would leave the field spinning with nothing to resolve it.
    act(() => {
      result.current.onQueryChange("draft ");
    });
    await waitOutDebounce();

    expect(result.current.isSearching).toBeFalsy();
    expect(searchPostsAdminMock).toHaveBeenCalledOnce();
    expect(result.current.posts[0]?.title).toBe("Draft post");
  });

  it("does not stay busy when an edit returns to the previous query", async () => {
    searchPostsAdminMock.mockResolvedValue({
      available: true,
      estimatedTotalHits: 1,
      hits: [draftHit],
      query: "draft",
    });

    const { result } = renderHook(() => useAdminPosts());
    await waitFor(() => {
      expect(result.current.searchAvailable).toBeTruthy();
    });

    act(() => {
      result.current.onQueryChange("draft");
    });
    await waitFor(() => {
      expect(searchPostsAdminMock).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
      expect(result.current.posts[0]?.title).toBe("Draft post");
    });

    // Typed and removed inside a single debounce window, so the debounced value
    // settles back on the query already searched for and issues no request.
    act(() => {
      result.current.onQueryChange("draftx");
    });
    act(() => {
      result.current.onQueryChange("draft");
    });
    await waitOutDebounce();

    expect(result.current.isSearching).toBeFalsy();
    expect(searchPostsAdminMock).toHaveBeenCalledOnce();
    expect(result.current.posts[0]?.title).toBe("Draft post");
  });
});
