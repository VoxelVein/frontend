import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Hero } from "@/components/hero";
import { categoryLabelSentence } from "@/lib/categories";

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

const BROWSE_PROJECTS = /browse projects/iu;
// Built from the registry so the assertion tracks the category list instead of
// freezing a copy of it — the old literal silently went stale when a category
// was added or reordered.
const HEADING = new RegExp(
  `discover the best ${categoryLabelSentence()}`,
  "iu"
);

describe(Hero, () => {
  // jsdom has no matchMedia; the headline animation checks reduced motion.
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn<
        () => Pick<
          MediaQueryList,
          "addEventListener" | "matches" | "removeEventListener"
        >
      >(() => ({
        addEventListener: vi.fn<MediaQueryList["addEventListener"]>(),
        matches: false,
        removeEventListener: vi.fn<MediaQueryList["removeEventListener"]>(),
      }))
    );
    // jsdom has no ResizeObserver; the rotating text measures its pill.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect = vi.fn<() => void>();
        observe = vi.fn<() => void>();
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the call to action as a plain link, not a button", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      // Silence expected output; the assertion below checks it stays empty.
    });

    render(<Hero />);

    const link = screen.getByRole("link", { name: BROWSE_PROJECTS });
    expect(link.getAttribute("href")).toBe("/mods");
    expect(screen.queryByRole("button", { name: BROWSE_PROJECTS })).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("gives the rotating heading one stable accessible name", () => {
    render(<Hero />);

    expect(
      screen.getByRole("heading", { level: 1, name: HEADING })
    ).toBeInTheDocument();
  });
});
