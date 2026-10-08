import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PostSummary } from "@/lib/posts";
// The listing is the index route. `/blog` itself is a layout that renders an
// `Outlet` for `/blog/$slug`, so importing from there would render nothing.
import { Route } from "@/routes/blog.index";

const {
  toastErrorMock,
  toastSuccessMock,
  toastDismissMock,
  listPostsMock,
  postSearchAvailableMock,
  searchPostsMock,
  useLoaderDataMock,
  useSessionMock,
} = vi.hoisted(() => ({
  listPostsMock: vi.fn<(opts: { data: object }) => Promise<PostSummary[]>>(),
  postSearchAvailableMock: vi.fn<() => Promise<boolean>>(),
  toastDismissMock: vi.fn<() => void>(),
  toastErrorMock: vi.fn<(message: string) => void>(),
  toastSuccessMock: vi.fn<(message: string) => void>(),
  searchPostsMock: vi.fn<
    (opts: { data: { query: string } }) => Promise<{
      estimatedTotalHits: number;
      hits: PostSummary[];
      query: string;
    }>
  >(),
  useLoaderDataMock: vi.fn<
    () => {
      posts: PostSummary[];
      searchAvailable: boolean;
    }
  >(),
  useSessionMock:
    vi.fn<() => { data: { user: { role: string | null } } | null }>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Action feedback is a toast; stubbing Sonner is what makes the call assertable
vi.mock("sonner", () => ({
  toast: {
    dismiss: toastDismissMock,
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The route component reads server functions; string paths avoid strict factory type-checking against the server function types
vi.mock("@/lib/posts.functions", () => ({
  listPosts: listPostsMock,
  postSearchAvailable: postSearchAvailableMock,
  searchPosts: searchPostsMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking -- The header shortcut gates on the session; stubbing the client avoids a network call in this test
vi.mock(import("@/lib/auth-client"), () => ({
  authClient: { useSession: useSessionMock },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The route component reads loader data through the router and PostCard renders a router Link; stubbing both avoids standing up a router in this test
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal();
  // SAFETY: The actual module is spread at runtime to preserve createFileRoute; the cast only widens the type for the mock factory
  return {
    ...(actual as object),
    Link: ({
      children,
      params,
      to,
    }: {
      children: ReactNode;
      params?: { slug: string };
      to: string;
    }) => <a href={to.replace("$slug", params?.slug ?? "")}>{children}</a>,
    useLoaderData: () => useLoaderDataMock(),
  };
});

/** Points the route's loader data at a given listing. */
const withPosts = (posts: PostSummary[], searchAvailable = false) => {
  listPostsMock.mockReset().mockResolvedValue(posts);
  postSearchAvailableMock.mockReset().mockResolvedValue(searchAvailable);
  useLoaderDataMock.mockReset().mockReturnValue({ posts, searchAvailable });
};

/** Presses one of the category filters. */
const chooseCategory = (name: string | RegExp) => {
  fireEvent.click(screen.getByRole("button", { name }));
};

const BlogPage = Route.options.component;
if (!BlogPage) {
  throw new Error("BlogPage component not found");
}

const postSummary: PostSummary = {
  authors: [],
  category: null,
  createdAt: "2026-01-15T10:30:00.000Z",
  excerpt: null,
  id: "post-1",
  preview: "Preview of the first post.",
  published: true,
  slug: "first-post",
  title: "First post",
  updatedAt: "2026-01-15T10:30:00.000Z",
};

const searchHit: PostSummary = {
  authors: [],
  category: null,
  createdAt: "2026-02-01T09:00:00.000Z",
  excerpt: null,
  id: "post-2",
  preview: "Preview of the second post.",
  published: true,
  slug: "second-post",
  title: "Second post",
  updatedAt: "2026-02-01T09:00:00.000Z",
};

const typeQuery = (value: string) => {
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Search blog posts" }),
    {
      target: { value },
    }
  );
};

describe("BlogPage", () => {
  beforeEach(() => {
    listPostsMock.mockReset().mockResolvedValue([postSummary]);
    postSearchAvailableMock.mockReset().mockResolvedValue(true);
    searchPostsMock.mockReset();
    useLoaderDataMock.mockReset().mockReturnValue({
      posts: [postSummary],
      searchAvailable: true,
    });
    useSessionMock.mockReset().mockReturnValue({ data: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists every post with its text preview", () => {
    render(<BlogPage />);

    expect(screen.getByText("First post")).toBeInTheDocument();
    expect(screen.getByText("Preview of the first post.")).toBeInTheDocument();
  });

  it("keeps the editor shortcut off the page for a reader", () => {
    useSessionMock.mockReturnValue({ data: { user: { role: "user" } } });

    render(<BlogPage />);

    expect(
      screen.queryByRole("link", { name: /new post/iu })
    ).not.toBeInTheDocument();
  });

  it("offers an admin the new-post editor from the index", () => {
    useSessionMock.mockReturnValue({ data: { user: { role: "admin" } } });

    render(<BlogPage />);

    const newPost = screen.getByRole("link", { name: /new post/iu });
    expect(newPost.getAttribute("href")).toBe("/admin/posts/new");
  });

  it("hides the search field when there is nothing to search", () => {
    useLoaderDataMock.mockReturnValue({
      posts: [postSummary],
      searchAvailable: false,
    });

    render(<BlogPage />);

    // The listing still works; only the unusable field is withheld.
    expect(
      screen.queryByRole("searchbox", { name: "Search blog posts" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("First post")).toBeInTheDocument();
  });

  it("searches the posts table and shows the hits", async () => {
    searchPostsMock.mockResolvedValue({
      estimatedTotalHits: 1,
      hits: [searchHit],
      query: "veins",
    });

    render(<BlogPage />);
    typeQuery("veins");

    await waitFor(() => {
      expect(screen.getByText("Second post")).toBeInTheDocument();
    });

    expect(searchPostsMock).toHaveBeenCalledWith({ data: { query: "veins" } });
  });

  it("reports a failed search and keeps the field usable", async () => {
    searchPostsMock.mockRejectedValue(new Error("Search is unavailable."));

    render(<BlogPage />);
    typeQuery("veins");

    // A failed search is action feedback, so a toast.
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Search is unavailable.");
    });

    // A transient failure must not cost the reader the search field.
    expect(
      screen.getByRole("searchbox", { name: "Search blog posts" })
    ).toBeInTheDocument();
  });

  it("reports when a search finds nothing", async () => {
    searchPostsMock.mockResolvedValue({
      estimatedTotalHits: 0,
      hits: [],
      query: "nothing",
    });

    render(<BlogPage />);
    typeQuery("nothing");

    await waitFor(() => {
      expect(screen.getByText("No posts found")).toBeInTheDocument();
    });
  });

  it("explains when there are no posts at all", () => {
    useLoaderDataMock.mockReturnValue({ posts: [], searchAvailable: true });

    render(<BlogPage />);

    expect(screen.getByText("No posts yet")).toBeInTheDocument();
  });
});

describe("BlogPage category filter", () => {
  const engineering: PostSummary = {
    ...postSummary,
    category: "engineering",
    id: "post-eng",
    title: "Shipping the API",
  };
  const security: PostSummary = {
    ...postSummary,
    category: "security",
    id: "post-sec",
    title: "Rotating a leaked key",
  };
  const uncategorised: PostSummary = {
    ...postSummary,
    category: null,
    id: "post-none",
    title: "Unfiled thoughts",
  };

  beforeEach(() => {
    searchPostsMock.mockReset();
    withPosts([engineering, security, uncategorised]);
  });

  it("offers a control only when there is a choice to make", () => {
    // One category means the filter could only ever confirm what is already
    // shown, so it is withheld rather than offered as a dead toggle.
    withPosts([engineering, { ...uncategorised, category: "engineering" }]);
    render(<BlogPage />);

    expect(
      screen.queryByRole("button", { name: /engineering/iu })
    ).not.toBeInTheDocument();
  });

  it("offers only the categories that have posts behind them", () => {
    render(<BlogPage />);

    expect(chooseCategory).toBeDefined();
    expect(
      screen.getByRole("button", { name: /engineering/iu })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /security/iu })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /changelog/iu })
    ).not.toBeInTheDocument();
  });

  it("shows every post until a category is chosen", () => {
    render(<BlogPage />);

    expect(screen.getByText("Shipping the API")).toBeInTheDocument();
    expect(screen.getByText("Rotating a leaked key")).toBeInTheDocument();
    expect(screen.getByText("Unfiled thoughts")).toBeInTheDocument();
  });

  it("narrows the listing to the chosen category", () => {
    render(<BlogPage />);
    chooseCategory(/engineering/iu);

    expect(screen.getByText("Shipping the API")).toBeInTheDocument();
    expect(screen.queryByText("Rotating a leaked key")).not.toBeInTheDocument();
    expect(screen.queryByText("Unfiled thoughts")).not.toBeInTheDocument();
  });

  it("marks the active category as pressed so the state is not visual only", () => {
    render(<BlogPage />);
    chooseCategory(/security/iu);

    expect(screen.getByRole("button", { name: /security/iu })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(
      screen.getByRole("button", { name: /engineering/iu })
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("names each category button with its count in words", () => {
    withPosts([engineering, { ...engineering, id: "post-eng-2" }, security]);
    render(<BlogPage />);

    // Read off the children this would be "Engineering2": JSX drops the gap,
    // which is CSS, so the announced name has to be stated.
    expect(
      screen.getByRole("button", { name: "Engineering, 2 posts" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Security, 1 post" })
    ).toBeInTheDocument();
  });

  it("returns to the full listing from All", () => {
    render(<BlogPage />);
    chooseCategory(/engineering/iu);
    chooseCategory(/^all$/iu);

    expect(screen.getByText("Rotating a leaked key")).toBeInTheDocument();
    expect(screen.getByText("Unfiled thoughts")).toBeInTheDocument();
  });

  it("announces the narrowed count, because the list changes in place", () => {
    render(<BlogPage />);
    chooseCategory(/engineering/iu);

    // Filtering does not navigate, so without a live region the change would
    // only ever be visible.
    expect(screen.getByText("1 post")).toBeInTheDocument();
  });

  it("keeps a chosen category while the reader searches", async () => {
    withPosts([engineering, security], true);
    searchPostsMock.mockResolvedValue({
      estimatedTotalHits: 1,
      hits: [security],
      query: "key",
    });

    render(<BlogPage />);
    chooseCategory(/security/iu);
    typeQuery("key");

    await waitFor(() => {
      expect(screen.getByText("Rotating a leaked key")).toBeInTheDocument();
    });

    // Both filters apply together: the reader asked for this category *and*
    // this term, and dropping either would widen the result set.
    expect(screen.getByRole("button", { name: /security/iu })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("says so when the two filters exclude everything rather than ignoring one", async () => {
    withPosts([engineering, security], true);
    searchPostsMock.mockResolvedValue({
      estimatedTotalHits: 1,
      hits: [security],
      query: "key",
    });

    render(<BlogPage />);
    chooseCategory(/engineering/iu);
    typeQuery("key");

    // Silently falling back to the unfiltered hits would put the reader in a
    // security post they had just ruled out by asking for Engineering.
    await waitFor(() => {
      expect(screen.getByText("Nothing in this category")).toBeInTheDocument();
    });

    expect(
      screen.getByText("No post matches both that category and your search.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Rotating a leaked key")).not.toBeInTheDocument();
  });
});
