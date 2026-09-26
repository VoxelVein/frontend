import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { PostCard } from "@/components/blog/post-card";

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The card renders a router Link; a stub keeps this test on the card's own behaviour instead of standing up a router
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

const post = {
  createdAt: "2026-01-15T10:30:00.000Z",
  preview: "A short teaser derived from the body.",
  slug: "hello-world",
  title: "Hello world",
};

describe(PostCard, () => {
  it("shows the title and the text preview", () => {
    render(<PostCard post={post} />);

    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(
      screen.getByText("A short teaser derived from the body.")
    ).toBeInTheDocument();
  });

  it("renders the whole card as a single link to the article", () => {
    render(<PostCard post={post} />);

    const links = screen.getAllByRole("link");

    // One link covering the card is what makes clicking anywhere on it open the
    // article, rather than only the title.
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/blog/hello-world");
    expect(links[0]).toHaveAccessibleName("Read Hello world");
  });

  it("renders the publication date as a machine-readable time", () => {
    render(<PostCard post={post} />);

    expect(screen.getByText(/2026/u)).toHaveAttribute(
      "datetime",
      "2026-01-15T10:30:00.000Z"
    );
  });

  it("omits the date when the timestamp cannot be parsed", () => {
    // A search hit indexed before the timestamp was stored has no usable date.
    render(<PostCard post={{ ...post, createdAt: "not-a-date" }} />);

    expect(screen.queryByText(/not-a-date/u)).not.toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("omits the preview paragraph when there is no preview", () => {
    render(<PostCard post={{ ...post, preview: "" }} />);

    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });
});
