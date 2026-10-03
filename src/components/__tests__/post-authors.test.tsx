import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { PostAuthors } from "@/components/blog/post-authors";
import type { PostAuthor } from "@/lib/posts";

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The byline links to profiles; a stub keeps this suite on the component's own markup
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
    params,
    to,
  }: {
    children: ReactNode;
    className?: string;
    params?: { username: string };
    to: string;
  }) => (
    <a
      className={className}
      href={to.replace("$username", params?.username ?? "")}
    >
      {children}
    </a>
  ),
}));

const author = (
  id: string,
  name: string,
  username: string | null
): PostAuthor => ({
  id,
  image: null,
  name,
  username,
});

const AUTHORS = [
  author("a1", "Hedi Zandi", "hedi"),
  author("a2", "Ben Sabic", "ben"),
  author("a3", "Dima Voytenko", "dima"),
];

const list = () => screen.getByRole("list", { name: "Authors" });

describe(PostAuthors, () => {
  it("keeps overlapping pictures separated with a background ring", () => {
    render(<PostAuthors authors={AUTHORS} />);

    // The pictures sit flush against one another, so the separation has to be a
    // permanent ring in the background colour rather than something that appears
    // on hover.
    for (const item of list().querySelectorAll("li")) {
      expect(item.className).toContain("ring-2");
      expect(item.className).toContain("ring-background");
    }
  });

  it("draws no ring offset, which was the stray-circle artefact", () => {
    render(<PostAuthors authors={AUTHORS} />);

    // A ring offset paints a background-coloured disc *outside* the element, so
    // hovering one picture in a stack left visible discs behind it.
    for (const item of list().querySelectorAll("li, li a")) {
      expect(item.className).not.toContain("ring-offset");
    }
  });

  it("raises the hovered picture above its neighbours", () => {
    render(<PostAuthors authors={AUTHORS} />);

    // Without this the neighbouring avatar paints over the hover state, since
    // the stack overlaps.
    for (const link of list().querySelectorAll("li a")) {
      expect(link.className).toContain("hover:z-10");
    }
  });

  it("still exposes each author as a link to their profile", () => {
    render(<PostAuthors authors={AUTHORS} />);

    expect(screen.getByRole("link", { name: "Hedi Zandi" })).toHaveAttribute(
      "href",
      "/u/hedi"
    );
  });

  it("keeps every author reachable when links are turned off", () => {
    render(<PostAuthors authors={AUTHORS} linked={false} />);

    expect(list().querySelectorAll("li")).toHaveLength(3);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.getByText("By Hedi Zandi, Ben Sabic, Dima Voytenko")
    ).toBeInTheDocument();
  });

  it("renders nothing at all when there is no author", () => {
    const { container } = render(<PostAuthors authors={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
