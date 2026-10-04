import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectDetail } from "@/components/projects/project-detail";
import type { ProjectVersionView, ProjectView } from "@/lib/projects";

const { useSessionMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn<() => { data: { user: { id: string } } | null }>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The session comes from Better Auth over the network; this suite is about layout and copy
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: useSessionMock },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The report dialog and the admin protection control both post to server functions, which pull the database in; this suite is about layout and copy
vi.mock("@/lib/reports.functions", () => ({
  createReport: vi.fn<(opts: { data: unknown }) => Promise<void>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Same reason as reports.functions: the protection control imports it at module scope
vi.mock("@/lib/projects.functions", () => ({
  setProjectProtected: vi.fn<(opts: { data: unknown }) => Promise<void>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Links need a router instance; a plain anchor keeps the test on the page's own structure
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: ComponentProps<"a"> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const FILE_ID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const OTHER_FILE_ID = "4a3b2c1d-6e5f-4b7a-8c9d-0e1f2a3b4c5e";

const version = (
  overrides: Partial<ProjectVersionView> = {}
): ProjectVersionView => ({
  changelog: "",
  channel: "release",
  createdAt: "2026-09-20T00:00:00.000Z",
  downloads: 12,
  files: [
    {
      filename: "sodium-0.6.0.jar",
      id: FILE_ID,
      primary: true,
      sha1: "a",
      sha512: "b",
      size: 2_200_000,
    },
  ],
  gameVersions: ["1.21.4", "1.21.1"],
  id: "v1",
  loaders: ["fabric", "forge"],
  name: "0.6.0",
  versionNumber: "0.6.0",
  ...overrides,
});

const project = (overrides: Partial<ProjectView> = {}): ProjectView => ({
  author: "Alice",
  authorUsername: "alice",
  category: "performance",
  description: "A rendering engine.",
  downloads: 1_240_000,
  gallery: [],
  icon: null,
  id: "0b8f7c1e-4b1a-4c7e-9a55-1c2d3e4f5a6b",
  isProtected: false,
  name: "Sodium",
  ownerId: "user-alice",
  pendingDeletion: false,
  publishedAt: "2026-09-01T00:00:00.000Z",
  rejectionReason: null,
  server: null,
  slug: "sodium",
  status: "published",
  summary: "A modern rendering engine for Minecraft.",
  tags: ["performance"],
  type: "mod",
  updatedAt: "2026-09-20T00:00:00.000Z",
  versions: [version()],
  ...overrides,
});

/** The download sidebar, which is what this suite is about. */
const panel = () => screen.getByRole("region", { name: /^download$/iu });

describe(ProjectDetail, () => {
  beforeEach(() => {
    useSessionMock.mockReset().mockReturnValue({ data: null });
    // jsdom has neither observer; the report dialog and Reveal want them.
    class ObserverStub {
      disconnect = vi.fn<() => void>();
      observe = vi.fn<() => void>();
      unobserve = vi.fn<() => void>();
    }
    vi.stubGlobal("IntersectionObserver", ObserverStub);
    vi.stubGlobal("ResizeObserver", ObserverStub);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("offers the newest version's file above the description", () => {
    render(<ProjectDetail project={project()} />);

    // The versions table used to be the last section on the page, so someone
    // who came to install a mod read the description and the gallery first.
    const order = [...document.querySelectorAll("h1, h2, p")];
    expect(
      order.indexOf(
        screen.getByRole("heading", { level: 2, name: /^download$/iu })
      )
    ).toBeLessThan(
      order.indexOf(screen.getByRole("heading", { name: /about this mod/iu }))
    );
  });

  it("links the primary file at the download endpoint", () => {
    render(<ProjectDetail project={project()} />);

    const link = within(panel()).getByRole("link", {
      name: /download sodium-0\.6\.0\.jar/iu,
    });
    expect(link.getAttribute("href")).toBe(`/api/download/${FILE_ID}`);
  });

  it("names the file in the download link's accessible name", () => {
    render(<ProjectDetail project={project()} />);

    // The visible label is only "Download", so without the filename a screen
    // reader announces the same word for every version on the site.
    const links = within(panel()).getAllByRole("link", { name: /^download/iu });
    expect(links[0].getAttribute("aria-label")).toContain("sodium-0.6.0.jar");
  });

  it("lists a version's other files as links beneath the primary one", () => {
    render(
      <ProjectDetail
        project={project({
          versions: [
            version({
              files: [
                version().files[0],
                {
                  filename: "sodium-0.6.0-sources.jar",
                  id: OTHER_FILE_ID,
                  primary: false,
                  sha1: "c",
                  sha512: "d",
                  size: 500_000,
                },
              ],
            }),
          ],
        })}
      />
    );

    expect(
      within(panel())
        .getByRole("link", { name: /sodium-0\.6\.0-sources/iu })
        .getAttribute("href")
    ).toBe(`/api/download/${OTHER_FILE_ID}`);
  });

  it("lists the loaders a version runs on", () => {
    render(<ProjectDetail project={project()} />);

    for (const loader of ["fabric", "forge"]) {
      expect(within(panel()).getByText(loader)).toBeInTheDocument();
    }
    expect(
      within(panel()).getByText("Loaders", { selector: "p" })
    ).toBeInTheDocument();
  });

  it("lists the Minecraft versions as their own scannable items", () => {
    render(<ProjectDetail project={project()} />);

    for (const gameVersion of ["1.21.4", "1.21.1"]) {
      expect(within(panel()).getByText(gameVersion)).toBeInTheDocument();
    }
    expect(
      within(panel()).queryByText("1.21.4, 1.21.1")
    ).not.toBeInTheDocument();
  });

  it("uses the plugin vocabulary for a plugin", () => {
    render(<ProjectDetail project={project({ type: "plugin" })} />);

    // A Paper plugin is not a "loader", and the publish form and browse filter
    // already call it a platform. This heading has to agree with them.
    expect(
      within(panel()).getByText("Platforms", { selector: "p" })
    ).toBeInTheDocument();
  });

  it("omits the loader block for a type that has no loaders", () => {
    render(<ProjectDetail project={project({ type: "resourcepack" })} />);

    // Resource packs and datapacks are dropped into a folder by hand, so
    // there is no loader axis to show — the same predicate the publish form
    // uses decides.
    expect(
      within(panel()).queryByText("Loaders", { selector: "p" })
    ).not.toBeInTheDocument();
    expect(
      within(panel()).getByText("Minecraft version", { selector: "p" })
    ).toBeInTheDocument();
  });

  it("says so when nothing has been specified", () => {
    render(
      <ProjectDetail
        project={project({ versions: [version({ loaders: [] })] })}
      />
    );

    // "We don't know" and "nothing" are different answers, so an empty list
    // gets words rather than an empty row.
    expect(within(panel()).getByText("Not specified.")).toBeInTheDocument();
  });

  it("keeps the full history in a real table below the panel", () => {
    render(
      <ProjectDetail
        project={project({
          versions: [
            version(),
            version({ name: "0.5.0", versionNumber: "0.5.0" }),
          ],
        })}
      />
    );

    // Real table markup: this is tabular data with row and column headers, so
    // a screen reader can move cell by cell.
    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("rowheader", { name: /0\.6\.0/iu })
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("rowheader", { name: /0\.5\.0/iu })
    ).toBeInTheDocument();
  });

  it("offers no download link before anything is published", () => {
    render(<ProjectDetail project={project({ versions: [] })} />);

    expect(within(panel()).queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.getByText(/nothing has been published yet/iu)
    ).toBeInTheDocument();
  });

  it("shows the lifetime download count", () => {
    render(<ProjectDetail project={project()} />);

    expect(within(panel()).getByText("1.2M")).toBeInTheDocument();
  });

  it("never skips a heading level", () => {
    render(<ProjectDetail project={project()} />);

    const levels = screen
      .getAllByRole("heading")
      .map((heading) => Number(heading.tagName.slice(1)));

    expect(levels[0]).toBe(1);
    for (const [index, level] of levels.entries()) {
      expect(level - (levels[index - 1] ?? 1)).toBeLessThanOrEqual(1);
    }
  });

  it("titles the description section after the project's own type", () => {
    render(<ProjectDetail project={project({ type: "datapack" })} />);

    // "Description" was a generic heading; "About this datapack" tells the
    // reader what they are reading about.
    expect(
      screen.getByRole("heading", { name: /about this datapack/iu })
    ).toBeInTheDocument();
  });
});
