import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectDocument } from "@/lib/projects";
import type { PublicProfile } from "@/lib/user-profiles";

// Relative rather than aliased: the `$username` in the file name is what
// TanStack's route files are called, and the alias resolver does not treat it
// as a literal segment.
import { Route } from "../routes/u.$username";

const { useLoaderDataMock } = vi.hoisted(() => ({
  useLoaderDataMock: vi.fn<() => PublicProfile>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The component reads loader data through the router and ProjectCard renders a router Link; stubbing both avoids standing up a router
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
      params?: { username: string };
      to: string;
    }) => (
      <a href={to.replace("$username", params?.username ?? "")}>{children}</a>
    ),
    useLoaderData: () => useLoaderDataMock(),
  };
});

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- ProjectCard is covered by its own rendering; a stub keeps this test on the profile page
vi.mock("@/components/projects/project-card", () => ({
  ProjectCard: ({ project }: { project: ProjectDocument }) => (
    <div data-testid={`project-${project.id}`}>{project.name}</div>
  ),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The route's loader reaches the database at import time; the loader's own gating is verified against a real database, so a stub keeps this test on rendering
vi.mock("@/lib/user-profiles.functions", () => ({
  getPublicProfile: vi.fn<() => Promise<null>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The report dialog posts to a server function, which reaches the database at import time; this suite is about rendering, so it is stubbed
vi.mock("@/lib/reports.functions", () => ({
  createReport: vi.fn<(opts: { data: unknown }) => Promise<void>>(),
}));

interface HeadResult {
  meta: { content?: string; name?: string; title?: string }[];
}

const ProfilePage = Route.options.component;
if (!ProfilePage) {
  throw new Error("ProfilePage component not found");
}

// SAFETY: The real head callback takes a full route-match object, but it reads
// only loaderData and the current pathname. Narrowing to those two fields keeps
// the test off TanStack's match types without weakening what the assertions
// check.
const head = Route.options.head as (args: {
  loaderData?: PublicProfile;
  match: { pathname: string };
}) => HeadResult;

const project = (
  overrides: Partial<ProjectDocument> = {}
): ProjectDocument => ({
  author: "Ada",
  authorUsername: "ada",
  category: "optimization",
  description: "A summary.",
  downloads: 10,
  gallery: [],
  gameVersions: ["1.21"],
  icon: null,
  id: "11111111-1111-4111-8111-111111111111",
  loaders: ["fabric"],
  name: "Sodium",
  slug: "sodium",
  tags: [],
  type: "mod",
  updatedAt: "2026-09-01T00:00:00.000Z",
  version: "1.0.0",
  ...overrides,
});

const profile = (overrides: Partial<PublicProfile> = {}): PublicProfile => ({
  bio: "I make mods that make Minecraft run faster.",
  displayUsername: "Ada",
  image: null,
  joinedAt: "2025-01-01T00:00:00.000Z",
  name: "Ada Lovelace",
  projects: [project()],
  username: "ada",
  ...overrides,
});

describe("the profile page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the display username as the page heading", () => {
    useLoaderDataMock.mockReturnValue(
      profile({ displayUsername: "ada.codes" })
    );

    render(<ProfilePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "ada.codes" })
    ).toBeTruthy();
  });

  it("renders the bio as Markdown rather than as literal text", () => {
    useLoaderDataMock.mockReturnValue(
      profile({ bio: "I make **fast** mods." })
    );

    render(<ProfilePage />);

    // A strong element only exists if the Markdown was parsed and rendered.
    expect(screen.getByText("fast").tagName).toBe("STRONG");
  });

  it("omits the bio block entirely when there is no bio", () => {
    useLoaderDataMock.mockReturnValue(profile({ bio: null }));

    render(<ProfilePage />);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(
      screen.queryByText("I make mods that make Minecraft run faster.")
    ).toBeNull();
  });

  it("lists the user's projects", () => {
    useLoaderDataMock.mockReturnValue(
      profile({
        projects: [project(), project({ id: "other", name: "Lithium" })],
      })
    );

    render(<ProfilePage />);

    expect(
      screen.getByTestId("project-11111111-1111-4111-8111-111111111111")
    ).toBeTruthy();
    expect(screen.getByTestId("project-other")).toBeInTheDocument();
  });

  it("explains the empty state when the user has no public projects", () => {
    useLoaderDataMock.mockReturnValue(profile({ projects: [] }));

    render(<ProfilePage />);

    expect(screen.getByText("No public projects yet")).toBeInTheDocument();
  });

  it("shows the name and join date alongside the heading", () => {
    useLoaderDataMock.mockReturnValue(profile());

    render(<ProfilePage />);

    expect(screen.getByText(/Ada Lovelace/u)).toBeInTheDocument();
    expect(screen.getByText(/Joined/u)).toBeInTheDocument();
  });

  it("describes the page with the bio stripped to plain text", () => {
    const result = head({
      loaderData: profile({ bio: "I make **fast** mods." }),
      match: { pathname: "/u/ada-lovelace" },
    });

    // Markdown syntax must not reach a meta description, which is text.
    expect(result.meta).toContainEqual({
      content: "I make fast mods.",
      name: "description",
    });
  });

  it("leaves out the meta description when there is no bio", () => {
    const result = head({
      loaderData: profile({ bio: null }),
      match: { pathname: "/u/ada-lovelace" },
    });

    expect(result.meta).not.toContainEqual(
      expect.objectContaining({ name: "description" })
    );
  });
});
