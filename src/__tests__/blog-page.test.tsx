import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PostSummary } from "@/lib/posts";
import type { PostSearchDocument } from "@/lib/posts-search";
import { Route } from "@/routes/blog";

const {
  listPostsMock,
  postSearchAvailableMock,
  searchPostsMock,
  useLoaderDataMock,
} = vi.hoisted(() => ({
  listPostsMock: vi.fn<(opts: { data: object }) => Promise<PostSummary[]>>(),
  postSearchAvailableMock: vi.fn<() => Promise<boolean>>(),
  searchPostsMock: vi.fn<
    (opts: { data: { query: string } }) => Promise<{
      available: boolean;
      estimatedTotalHits: number;
      hits: PostSearchDocument[];
      query: string;
    }>
  >(),
  useLoaderDataMock: vi.fn<
    () => {
      posts: PostSummary[];
      searchAvailable: boolean;
    }
  >(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The route reads server functions; string paths avoid strict factory type-checking against the server function types
vi.mock("@/lib/posts.functions", () => ({
  listPosts: listPostsMock,
  postSearchAvailable: postSearchAvailableMock,
  searchPosts: searchPostsMock,
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

const BlogPage = Route.options.component;
if (!BlogPage) {
  throw new Error("BlogPage component not found");
}

const postSummary: PostSummary = {
  createdAt: "2026-01-15T10:30:00.000Z",
  excerpt: null,
  id: "post-1",
  preview: "Preview of the first post.",
  published: true,
  slug: "first-post",
  title: "First post",
  updatedAt: "2026-01-15T10:30:00.000Z",
};

const searchHit: PostSearchDocument = {
  content: "Body text about voxel veins.",
  createdAt: "2026-02-01T09:00:00.000Z",
  createdAtTs: Date.parse("2026-02-01T09:00:00.000Z"),
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists every post with its text preview", () => {
    render(<BlogPage />);

    expect(screen.getByText("First post")).toBeInTheDocument();
    expect(screen.getByText("Preview of the first post.")).toBeInTheDocument();
  });

  it("hides the search field when Meilisearch is unavailable", () => {
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

  it("searches through Meilisearch and shows the hits", async () => {
    searchPostsMock.mockResolvedValue({
      available: true,
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

  it("deactivates search when a query reports it is unavailable", async () => {
    searchPostsMock.mockResolvedValue({
      available: false,
      estimatedTotalHits: 0,
      hits: [],
      query: "veins",
    });

    render(<BlogPage />);
    typeQuery("veins");

    await waitFor(() => {
      expect(
        screen.queryByRole("searchbox", { name: "Search blog posts" })
      ).not.toBeInTheDocument();
    });

    // Falling back to the database listing beats leaving a field that does nothing.
    expect(screen.getByText("First post")).toBeInTheDocument();
  });

  it("reports when a search finds nothing", async () => {
    searchPostsMock.mockResolvedValue({
      available: true,
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
