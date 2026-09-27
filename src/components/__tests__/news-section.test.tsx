import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewsSection } from "@/components/news-section";
import type { PostSummary } from "@/lib/posts";

const { getLatestPostsMock } = vi.hoisted(() => ({
  getLatestPostsMock: vi.fn<() => Promise<PostSummary[]>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Server functions run on the server; string path avoids strict factory type-checking against the server function types
vi.mock("@/lib/posts.functions", () => ({
  getLatestPosts: getLatestPostsMock,
  POSTS_REFRESH_MS: 300_000,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Router context is unavailable in unit tests; string path avoids strict factory type-checking against the router module
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
  };
});

const SECTION_NAME = /news/iu;

const makePost = (
  id: string,
  title: string,
  slug: string,
  day: string
): PostSummary => ({
  createdAt: `2026-01-${day}T10:30:00.000Z`,
  excerpt: null,
  id,
  preview: `Preview of ${title}.`,
  published: true,
  slug,
  title,
  updatedAt: `2026-01-${day}T10:30:00.000Z`,
});

/** Newest first, the order getLatestPosts returns them in. */
const POSTS = [
  makePost("post-1", "Sodium is here", "sodium-is-here", "18"),
  makePost("post-2", "Fabric moves fast", "fabric-moves-fast", "11"),
  makePost("post-3", "Search rebuilt", "search-rebuilt", "04"),
];

const renderSection = (initialPosts: PostSummary[]) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<NewsSection initialPosts={initialPosts} />, { wrapper });
};

describe(NewsSection, () => {
  beforeEach(() => {
    // jsdom has no IntersectionObserver; Reveal gates its animation on one.
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        disconnect = vi.fn<() => void>();
        observe = vi.fn<() => void>();
        unobserve = vi.fn<() => void>();
      }
    );

    getLatestPostsMock.mockReset().mockResolvedValue([]);
  });

  it("labels the section with a heading the assistive tech can read", () => {
    renderSection(POSTS);

    expect(
      screen.getByRole("region", { name: SECTION_NAME })
    ).toBeInTheDocument();
  });

  it("nests each post title under the section heading", () => {
    renderSection(POSTS);

    const region = screen.getByRole("region", { name: SECTION_NAME });

    // Exactly one h2: the section's own. The cards must not introduce siblings
    // that compete with it, so their titles are h3s nested underneath.
    expect(within(region).getAllByRole("heading", { level: 2 })).toHaveLength(
      1
    );
    expect(within(region).getAllByRole("heading", { level: 3 })).toHaveLength(
      POSTS.length
    );

    for (const post of POSTS) {
      expect(
        within(region).getByRole("heading", { level: 3, name: post.title })
      ).toBeInTheDocument();
    }
  });

  it("links each post to its own blog page", () => {
    renderSection(POSTS);

    for (const post of POSTS) {
      const link = screen.getByRole("link", { name: `Read ${post.title}` });
      expect(link.getAttribute("href")).toBe(`/blog/${post.slug}`);
    }
  });

  it("offers a way to reach the blog from the section header", () => {
    renderSection(POSTS);

    const allPosts = screen.getByRole("link", { name: /all posts/iu });
    expect(allPosts.getAttribute("href")).toBe("/blog");
  });

  it("gives the newest post the lead position", () => {
    renderSection(POSTS);

    const region = screen.getByRole("region", { name: SECTION_NAME });
    const titles = within(region)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    // getLatestPosts returns newest first, so the lead story is the first entry
    // and that order has to survive into the list.
    expect(titles).toStrictEqual(POSTS.map((post) => post.title));
  });

  it("dates every entry in a machine-readable time element", () => {
    renderSection(POSTS);

    const region = screen.getByRole("region", { name: SECTION_NAME });
    const times = within(region).getAllByRole("time");

    expect(times).toHaveLength(POSTS.length);
    for (const post of POSTS) {
      const match = times.find(
        (element) => element.getAttribute("datetime") === post.createdAt
      );
      expect(match).toBeDefined();
      expect(match?.textContent).toBeTruthy();
    }
  });

  it("separates the lead story from the ledger with one decorative rule", () => {
    renderSection(POSTS);

    // Only between the two kinds of entry, so one rule for three posts.
    expect(screen.getAllByRole("separator", { hidden: true })).toHaveLength(1);
  });

  it("omits the rule when the lead story is the only post", () => {
    renderSection([POSTS[0]]);

    expect(
      screen.queryByRole("separator", { hidden: true })
    ).not.toBeInTheDocument();
  });

  it("shows the empty state until something is published", () => {
    renderSection([]);

    expect(screen.getByText("No posts yet")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  });
});
