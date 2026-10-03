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
  authors: [
    { id: "author-1", image: null, name: "Hedi Zandi", username: "hedi" },
    {
      id: "author-2",
      image: "https://cdn.example.com/ben.png",
      name: "Ben Sabic",
      username: "ben",
    },
  ],
  category: "engineering",
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

  it("shows the category as a readable label, not the stored slug", () => {
    render(<PostCard post={post} />);

    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.queryByText("engineering")).not.toBeInTheDocument();
  });

  it("shows no category chip when the post is uncategorised", () => {
    // Half the archive is uncategorised by design; a chip reading
    // "Uncategorised" on every second card would say less than its absence.
    render(<PostCard post={{ ...post, category: null }} />);

    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(screen.queryByText(/uncategorised/iu)).not.toBeInTheDocument();
  });

  it("names every author in one byline", () => {
    render(<PostCard post={post} />);

    expect(screen.getByText("Hedi Zandi, Ben Sabic")).toBeInTheDocument();
  });

  it("keeps author names out of the tab order so the card stays one link", () => {
    // The card's link is stretched over the whole tile, so a profile link
    // underneath it could not be reached by pointer and would read as a link
    // nested inside a link. The names stay, the links go.
    render(<PostCard post={post} />);

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("Hedi Zandi, Ben Sabic")).toBeInTheDocument();
  });

  it("omits the byline entirely for a post with no recorded author", () => {
    render(<PostCard post={{ ...post, authors: [] }} />);

    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Authors" })
    ).not.toBeInTheDocument();
  });
});
