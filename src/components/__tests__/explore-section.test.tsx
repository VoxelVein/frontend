import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExploreSection } from "@/components/explore-section";
import { MINECRAFT_CATEGORIES } from "@/lib/categories";

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Router context is unavailable in unit tests; string path avoids strict factory type-checking against the router module
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal();
  // SAFETY: The actual module is spread at runtime to preserve createFileRoute/redirect; the cast only widens the type for the mock factory
  return {
    ...(actual as object),
    Link: ({
      children,
      to,
      ...props
    }: ComponentProps<"a"> & { to: string }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

const AVAILABLE_LINKS = [
  { href: "/mods", label: "Browse Mods" },
  { href: "/plugins", label: "Browse Plugins" },
] as const;

const UNAVAILABLE_LABELS = MINECRAFT_CATEGORIES.filter(
  (category) => !category.available
).map((category) => category.label);

describe(ExploreSection, () => {
  // jsdom has no IntersectionObserver; Reveal gates its animation on one.
  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        disconnect = vi.fn<() => void>();
        observe = vi.fn<() => void>();
        unobserve = vi.fn<() => void>();
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("labels the section with a heading the assistive tech can read", () => {
    render(<ExploreSection />);

    // The accent pill is a separate span inside the heading, so this also
    // guards the accessible name against the two runs of text concatenating.
    const region = screen.getByRole("region", { name: /explore minecraft/iu });
    expect(
      within(region).getByRole("heading", {
        level: 2,
        name: /explore minecraft/iu,
      })
    ).toBeInTheDocument();
  });

  it("renders every category as a heading under that section", () => {
    render(<ExploreSection />);

    const region = screen.getByRole("region", { name: /explore minecraft/iu });
    const headings = within(region).getAllByRole("heading", { level: 3 });

    expect(headings).toHaveLength(MINECRAFT_CATEGORIES.length);
    for (const category of MINECRAFT_CATEGORIES) {
      expect(
        within(region).getByRole("heading", { level: 3, name: category.label })
      ).toBeInTheDocument();
    }
  });

  it("links only the categories whose browse route exists", () => {
    render(<ExploreSection />);

    for (const { href, label } of AVAILABLE_LINKS) {
      const link = screen.getByRole("link", { name: label });
      expect(link.getAttribute("href")).toBe(href);
    }

    // Nothing may advertise a destination that 404s.
    expect(screen.getAllByRole("link")).toHaveLength(AVAILABLE_LINKS.length);
  });

  it("marks categories without a route as coming soon instead of linking them", () => {
    render(<ExploreSection />);

    expect(screen.getAllByText("Soon")).toHaveLength(UNAVAILABLE_LABELS.length);
    for (const label of UNAVAILABLE_LABELS) {
      expect(
        screen.queryByRole("link", {
          name: new RegExp(`browse ${label}`, "iu"),
        })
      ).toBeNull();
    }
  });
});
