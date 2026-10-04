import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Hero } from "@/components/hero";
import { categoryLabelSentence } from "@/lib/categories";

interface SessionStub {
  data: { user: { id: string } } | null;
  isPending: boolean;
}

const { useSessionMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn<() => SessionStub>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The session comes from Better Auth over the network; a stub picks the signed-in state per test
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: useSessionMock },
}));

const signIn = () => {
  useSessionMock.mockReturnValue({
    data: { user: { id: "user-alice" } },
    isPending: false,
  });
};

const signOut = () => {
  useSessionMock.mockReturnValue({ data: null, isPending: false });
};

const pendingSession = () => {
  useSessionMock.mockReturnValue({ data: null, isPending: true });
};

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
const HEADLINE_PREFIX = "find your next";
const HEADING = new RegExp(
  `${HEADLINE_PREFIX} ${categoryLabelSentence()}`,
  "iu"
);

describe(Hero, () => {
  // jsdom has no matchMedia; the headline animation checks reduced motion.
  beforeEach(() => {
    // Signed out is the default so every test that does not care about the
    // session still renders a complete hero.
    useSessionMock.mockReset();
    signOut();
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

  it("offers the join call to action alongside the browse one", () => {
    render(<Hero />);

    // The hero used to link browsing only, leaving anyone who came to publish
    // with no way in. Both destinations are real routes, so neither button is
    // a placeholder.
    expect(
      screen.getByRole("link", { name: /join free/iu }).getAttribute("href")
    ).toBe("/signup");
    expect(
      screen.getByRole("link", { name: BROWSE_PROJECTS }).getAttribute("href")
    ).toBe("/mods");
  });

  it("swaps the join call to action for the dashboard once signed in", () => {
    signIn();
    render(<Hero />);

    // "Join free" to someone who already has an account is the bug this
    // guards: a dead-end call to action on the landing page.
    expect(
      screen.getByRole("link", { name: /your projects/iu }).getAttribute("href")
    ).toBe("/dashboard/projects");
    expect(screen.queryByRole("link", { name: /join free/iu })).toBeNull();
    // The browse half is unchanged: signing in does not change what a visitor
    // came to look at.
    expect(
      screen.getByRole("link", { name: BROWSE_PROJECTS }).getAttribute("href")
    ).toBe("/mods");
  });

  it("shows neither call to action label before the session resolves", () => {
    pendingSession();
    render(<Hero />);

    // Guessing signed-out would flash "Join free" at someone who is signed in.
    // The slot is empty until the answer is real, and the browse link is
    // already there to hold the row.
    expect(screen.queryByRole("link", { name: /join free/iu })).toBeNull();
    expect(screen.queryByRole("link", { name: /your projects/iu })).toBeNull();
    expect(
      screen.getByRole("link", { name: BROWSE_PROJECTS }).getAttribute("href")
    ).toBe("/mods");
  });

  it("prints the category list once, for screen readers only", () => {
    const { container } = render(<Hero />);

    // The list belongs to the sr-only sentence and nowhere else. The subhead
    // used to repeat it in full, which put two seven-item lists one hero apart
    // and read as a wall of text. Counted rather than negated because
    // jsdom does not apply `sr-only`, so `textContent` still sees the hidden
    // copy and a `not.toContain` would fail on the sentence that is meant to
    // be there.
    const list = categoryLabelSentence();
    expect(container.textContent?.split(list).length ?? 0).toBe(2);
  });
});
