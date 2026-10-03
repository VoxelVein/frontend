import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminPosts } from "@/components/admin/admin-posts";
import type { PostSummary } from "@/lib/posts";

interface NavigateOptions {
  to: string;
}

/** The shape a post search request takes, as the server function declares it. */
interface SearchRequest {
  data: { query: string };
}

/** The search index response, reduced to what this suite needs to satisfy. */
interface SearchResponse {
  estimatedTotalHits: number;
  hits: PostSummary[];
  query: string;
}

const { listPostsMock, postSearchAvailableMock, toastErrorMock } = vi.hoisted(
  () => ({
    listPostsMock:
      vi.fn<
        (opts: { data: Record<string, never> }) => Promise<PostSummary[]>
      >(),
    postSearchAvailableMock: vi.fn<() => Promise<boolean>>(),
    toastErrorMock: vi.fn<(message: string) => void>(),
  })
);

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The tab reads server functions; string paths avoid strict factory type-checking against the server function types
vi.mock("@/lib/posts.functions", () => ({
  deletePost: vi.fn<() => Promise<void>>(),
  listPosts: listPostsMock,
  postSearchAvailable: postSearchAvailableMock,
  searchPostsAdmin: vi.fn<(opts: SearchRequest) => Promise<SearchResponse>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Error feedback is a toast; stubbing Sonner is what makes the call assertable
vi.mock("sonner", () => ({
  toast: {
    dismiss: vi.fn<() => void>(),
    error: toastErrorMock,
    success: vi.fn<(message: string) => void>(),
  },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Rows link through the router and the New post button navigates; stubbing both keeps this suite on what the list renders
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal();
  // SAFETY: The actual module is spread at runtime to preserve Link's siblings; the cast only widens the type for the mock factory
  return {
    ...(actual as object),
    Link: ({
      children,
      params,
      to,
    }: {
      children: ReactNode;
      params?: { postId: string };
      to: string;
    }) => <a href={to.replace("$postId", params?.postId ?? "")}>{children}</a>,
    useNavigate: () => vi.fn<(options: NavigateOptions) => Promise<void>>(),
  };
});

const authors: PostSummary["authors"] = [
  { id: "a1", image: null, name: "Hedi Zandi", username: "hedi" },
  { id: "a2", image: null, name: "Ben Sabic", username: "ben" },
];

const post: PostSummary = {
  authors,
  category: "engineering",
  createdAt: "2026-01-15T10:30:00.000Z",
  excerpt: null,
  id: "post-1",
  preview: "Preview of the first post.",
  published: true,
  slug: "first-post",
  title: "First post",
  updatedAt: "2026-01-15T10:30:00.000Z",
};

const renderTab = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<AdminPosts />, { wrapper: Wrapper });
};

const rows = () => screen.getByRole("list", { name: "Blog posts" });

describe(AdminPosts, () => {
  beforeEach(() => {
    listPostsMock.mockReset().mockResolvedValue([post]);
    postSearchAvailableMock.mockReset().mockResolvedValue(false);
  });

  it("files each post under its category", async () => {
    listPostsMock.mockResolvedValue([
      { ...post, category: "security", id: "post-2", title: "Advisory" },
    ]);

    renderTab();

    await expect(screen.findByText("Security")).resolves.toBeInTheDocument();
  });

  it("names the authors of each post", async () => {
    renderTab();

    // Names only, no avatars: this list is read at a glance and a row of
    // overlapping circles per entry costs more room than it earns.
    await expect(
      screen.findByText("Hedi Zandi, Ben Sabic")
    ).resolves.toBeInTheDocument();
    expect(within(rows()).queryAllByRole("img")).toHaveLength(0);
  });

  it("keeps publication status beside the new category", async () => {
    listPostsMock.mockResolvedValue([{ ...post, published: false }]);

    renderTab();

    // Both facts land on the one post in the list, so the category chip was
    // added without displacing what the tab already said.
    await expect(screen.findByText("Draft")).resolves.toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
  });

  it("shows neither chip nor names for an uncategorised, unattributed post", async () => {
    listPostsMock.mockResolvedValue([{ ...post, authors: [], category: null }]);

    renderTab();

    await expect(screen.findByText("First post")).resolves.toBeInTheDocument();
    expect(screen.queryByText(/uncategorised/iu)).not.toBeInTheDocument();
  });
});
