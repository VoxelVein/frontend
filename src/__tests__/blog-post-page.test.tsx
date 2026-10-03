import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Post } from "@/lib/posts";
import { Route } from "@/routes/blog.$slug";

const { getPostMock, useLoaderDataMock } = vi.hoisted(() => ({
  getPostMock:
    vi.fn<(opts: { data: { slug: string } }) => Promise<Post | null>>(),
  useLoaderDataMock: vi.fn<() => { post: Post | null }>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The route reads a server function; a string path avoids strict factory type-checking against the server function types
vi.mock("@/lib/posts.functions", () => ({
  getPost: getPostMock,
}));

/** Fills a route pattern's `$params` the way the router would. */
const resolvePath = (to: string, params: Record<string, string>): string => {
  let path = to;

  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`$${key}`, () => value);
  }

  return path;
};

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The route reads loader data through the router and renders router Links; stubbing both avoids standing up a router in this test
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
      params?: Record<string, string>;
      to: string;
    }) => <a href={resolvePath(to, params ?? {})}>{children}</a>,
    useLoaderData: () => useLoaderDataMock(),
  };
});

const BlogPostPage = Route.options.component;
if (!BlogPostPage) {
  throw new Error("BlogPostPage component not found");
}

const authors: Post["authors"] = [
  { id: "a1", image: null, name: "Hedi Zandi", username: "hedi" },
  {
    id: "a2",
    image: "https://cdn.example.com/ben.png",
    name: "Ben Sabic",
    username: "ben",
  },
];

const post: Post = {
  authors,
  category: "engineering",
  content: "The body of the post.",
  createdAt: "2026-01-15T10:30:00.000Z",
  excerpt: "What this post is about.",
  id: "post-1",
  preview: "Preview.",
  published: true,
  slug: "hello-world",
  title: "Hello world",
  updatedAt: "2026-01-15T10:30:00.000Z",
};

const showPost = (overrides: Partial<Post> = {}) => {
  useLoaderDataMock.mockReturnValue({ post: { ...post, ...overrides } });
};

const breadcrumb = () => screen.getByRole("navigation", { name: "Breadcrumb" });

describe("BlogPostPage", () => {
  beforeEach(() => {
    useLoaderDataMock.mockReset();
  });

  it("shows the title, excerpt and body", () => {
    showPost();

    render(<BlogPostPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Hello world" })
    ).toBeInTheDocument();
    expect(screen.getByText("What this post is about.")).toBeInTheDocument();
    expect(screen.getByText("The body of the post.")).toBeInTheDocument();
  });

  it("places the breadcrumb under the title", () => {
    showPost();

    render(<BlogPostPage />);

    // Ordered as the brief asks: title first, then the trail that says where it
    // is filed. DOCUMENT_POSITION_FOLLOWING means the trail comes after.
    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading.compareDocumentPosition(breadcrumb())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("reads Blog / <category> with the category as the current page", () => {
    showPost();

    render(<BlogPostPage />);

    const items = within(breadcrumb()).getAllByRole("listitem");

    expect(items[0]).toHaveTextContent("Blog");
    expect(items[1]).toHaveTextContent("Engineering");
    // The page you are on is not somewhere to navigate to, so it is marked
    // rather than linked.
    expect(within(items[1]).getByText("Engineering")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(items[1]).queryByRole("link")).not.toBeInTheDocument();
  });

  it("links the Blog crumb back to the index", () => {
    showPost();

    render(<BlogPostPage />);

    expect(
      within(breadcrumb()).getByRole("link", { name: "Blog" })
    ).toHaveAttribute("href", "/blog");
  });

  it("shows the readable category, not the stored slug", () => {
    showPost({ category: "company-news" });

    render(<BlogPostPage />);

    expect(breadcrumb()).toHaveTextContent("Company News");
    expect(breadcrumb()).not.toHaveTextContent("company-news");
  });

  it("shows the category chip and the breadcrumb in agreement", () => {
    showPost();

    render(<BlogPostPage />);

    // Twice by design: once as the post's own fact, once as its place in the
    // trail. Two readings of the same category, never two different ones.
    expect(screen.getAllByText("Engineering")).toHaveLength(2);
    expect(breadcrumb()).toHaveTextContent("Engineering");
  });

  it("omits the category crumb for an uncategorised post", () => {
    showPost({ category: null });

    render(<BlogPostPage />);

    // The trail still orients the reader; an "Uncategorised" crumb would present
    // a storage detail as a section of the site.
    expect(within(breadcrumb()).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText(/uncategorised/iu)).not.toBeInTheDocument();
  });

  it("names every author in one byline", () => {
    showPost();

    render(<BlogPostPage />);

    expect(screen.getByText("By Hedi Zandi, Ben Sabic")).toBeInTheDocument();
  });

  it("links each author to their profile", () => {
    showPost();

    render(<BlogPostPage />);

    expect(screen.getByRole("link", { name: "Hedi Zandi" })).toHaveAttribute(
      "href",
      "/u/hedi"
    );
    expect(screen.getByRole("link", { name: "Ben Sabic" })).toHaveAttribute(
      "href",
      "/u/ben"
    );
  });

  it("offers no profile link for an account with no username", () => {
    showPost({ authors: [{ ...authors[0], username: null }] });

    render(<BlogPostPage />);

    expect(screen.getByText("By Hedi Zandi")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Hedi Zandi" })
    ).not.toBeInTheDocument();
  });

  it("shows no byline for a post with no recorded author", () => {
    showPost({ authors: [] });

    render(<BlogPostPage />);

    expect(
      screen.queryByRole("list", { name: "Authors" })
    ).not.toBeInTheDocument();
  });

  it("shows the publication date alone when the post was never revised", () => {
    showPost();

    render(<BlogPostPage />);

    expect(screen.getByText("January 15, 2026")).toBeInTheDocument();
    expect(screen.queryByText(/updated/iu)).not.toBeInTheDocument();
  });

  it("advertises the revision once the post has actually changed", () => {
    showPost({ updatedAt: "2026-03-02T08:00:00.000Z" });

    render(<BlogPostPage />);

    // Both dates stay readable: when it was published still matters after a
    // revision, and a post that changed today may have shipped months ago.
    expect(screen.getByText("January 15, 2026")).toBeInTheDocument();
    expect(screen.getByText("March 2, 2026")).toBeInTheDocument();
  });

  it("treats a same-second update as no update", () => {
    // A post created and touched within one second is not a revised post, and
    // claiming otherwise would put "Updated" on every fresh draft.
    showPost({ updatedAt: "2026-01-15T10:30:00.400Z" });

    render(<BlogPostPage />);

    expect(screen.queryByText(/updated/iu)).not.toBeInTheDocument();
  });

  it("explains a missing post instead of rendering an empty article", () => {
    useLoaderDataMock.mockReturnValue({ post: null });

    render(<BlogPostPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Post not found" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to blog/iu })
    ).toHaveAttribute("href", "/blog");
  });

  it("never lets a payload from the body reach the document", () => {
    // The page is the only place author content is rendered on the public site,
    // so this is the assertion that matters most of all: whatever the body
    // contains, the page it produces holds no script element and no handler.
    showPost({
      content:
        '<img src="/a.png" alt="a" onerror="steal()">\n\n<script>alert(1)</script>',
    });

    const { container } = render(<BlogPostPage />);

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
  });
});
