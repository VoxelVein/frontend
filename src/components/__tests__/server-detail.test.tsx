import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ServerDetail } from "@/components/projects/server-detail";
import type { ProjectServerView, ProjectView } from "@/lib/projects";

const { useSessionMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn<() => { data: { user: { id: string } } | null }>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The session comes from Better Auth over the network; this suite is about layout and copy
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: useSessionMock },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The report dialog posts to a server function, which pulls the database in; this suite is about the server page's layout and copy
vi.mock("@/lib/reports.functions", () => ({
  createReport: vi.fn<(opts: { data: unknown }) => Promise<void>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Links need a router instance; a plain anchor keeps the test on the page's own structure
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: ComponentProps<"a"> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const SERVER: ProjectServerView = {
  address: "play.example.com",
  clientRequirement: "required",
  gameVersions: ["1.21.4", "1.21.1", "1.20.6"],
  links: [
    {
      id: "link-1",
      name: "Required Optimisations",
      published: true,
      required: true,
      slug: "required-optimisations",
      type: "mod",
    },
    {
      id: "link-2",
      name: "Sodium",
      published: true,
      required: false,
      slug: "sodium",
      type: "mod",
    },
  ],
  port: null,
};

const PROJECT: ProjectView = {
  author: "Alice",
  authorUsername: "alice",
  category: "skyblock",
  description: "A long-running skyblock server.",
  downloads: 0,
  gallery: [],
  icon: null,
  id: "0b8f7c1e-4b1a-4c7e-9a55-1c2d3e4f5a6b",
  isProtected: false,
  name: "Sky Realm",
  ownerId: "user-alice",
  pendingDeletion: false,
  publishedAt: "2026-09-01T00:00:00.000Z",
  rejectionReason: null,
  server: SERVER,
  slug: "sky-realm",
  status: "published",
  summary: "A skyblock server with a long season.",
  tags: [],
  type: "server",
  updatedAt: "2026-09-20T00:00:00.000Z",
  versions: [],
};

/**
 * The nearest ancestor that holds a heading and the rows under it.
 *
 * `parentElement` rather than a wrapper lookup because the requirement groups
 * are plain `<div>`s, not regions — and `SAFETY:` because the heading is
 * rendered by this same file's component tree, so a heading always has a parent.
 */
const groupFor = (heading: HTMLElement): HTMLElement => {
  // SAFETY: rendered by `ServerDetail`, so the heading is in the document and
  // always has a parent element.
  const parent = heading.parentElement;
  if (parent === null) {
    throw new Error("heading has no parent element");
  }
  return parent;
};

/**
 * Replaces `navigator.clipboard`.
 *
 * `vi.stubGlobal("clipboard", …)` does not work here: jsdom exposes the
 * clipboard on `navigator`, and stubbing the bare global leaves
 * `navigator.clipboard` undefined — so the component's write throws and the
 * "copied" branch can never be reached. That is also why the failure case below
 * needs an explicit rejection rather than relying on the absence.
 */
const stubClipboard = (writeText: (text: string) => Promise<void>) => {
  // SAFETY: jsdom's `navigator` has no `clipboard` own property, so defining
  // one is additive and clobbers nothing.
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
};

describe(ServerDetail, () => {
  beforeEach(() => {
    useSessionMock.mockReset().mockReturnValue({ data: null });
    // jsdom has neither observer. One class satisfies both interfaces: the
    // report dialog and Reveal want IntersectionObserver, the icon swap wants
    // ResizeObserver, and neither calls anything beyond these three methods.
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
    // SAFETY: the property was defined as configurable above, so deleting it
    // restores jsdom's original `navigator`.
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("leads with the join address rather than the description", () => {
    render(<ServerDetail project={PROJECT} />);

    // The old page put the address in a "Join" section below the stats, the
    // summary, the description, and the gallery — the one thing a visitor came
    // for was last on the screen. Compared over document order, because that is
    // what decides both the visual order below `lg` and the reading order
    // above it.
    const order = [...document.querySelectorAll("h1, h2, p")];
    expect(order.indexOf(screen.getByText("play.example.com"))).toBeLessThan(
      order.indexOf(
        screen.getByRole("heading", { name: /about this server/iu })
      )
    );
  });

  it("shows the address without the default port and appends a custom one", () => {
    const { rerender } = render(<ServerDetail project={PROJECT} />);
    expect(screen.getByText("play.example.com")).toBeInTheDocument();

    rerender(
      <ServerDetail
        project={{ ...PROJECT, server: { ...SERVER, port: 25_566 } }}
      />
    );
    expect(screen.getByText("play.example.com:25566")).toBeInTheDocument();
  });

  it("copies the address and confirms it in a live region", async () => {
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockResolvedValue();
    stubClipboard(writeText);

    render(<ServerDetail project={PROJECT} />);
    fireEvent.click(screen.getByRole("button", { name: /copy address/iu }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("play.example.com");
    });
    await waitFor(() => {
      expect(
        screen.getByText("Address copied to your clipboard.")
      ).toBeInTheDocument();
    });
  });

  it("offers a manual fallback when the clipboard write fails", async () => {
    stubClipboard(
      vi.fn<() => Promise<void>>().mockRejectedValue(new Error("denied"))
    );

    render(<ServerDetail project={PROJECT} />);
    fireEvent.click(screen.getByRole("button", { name: /copy address/iu }));

    // Not a dead end: the address is `select-all`, so the message tells the
    // reader what to do rather than only reporting that it failed.
    await waitFor(() => {
      expect(
        screen.getByText(/select the address above/iu)
      ).toBeInTheDocument();
    });
  });

  it("lists each supported version as its own scannable item", () => {
    render(<ServerDetail project={PROJECT} />);

    // Was a comma-joined sentence. A player matches these against their own
    // launcher, so they have to be separable at a glance.
    for (const version of SERVER.gameVersions) {
      expect(screen.getByText(version)).toBeInTheDocument();
    }
    expect(
      screen.queryByText(SERVER.gameVersions.join(", "))
    ).not.toBeInTheDocument();
  });

  it("separates required client content from recommended", () => {
    render(<ServerDetail project={PROJECT} />);

    // The distinction decides whether someone can get in at all, so it cannot
    // live as body text inside one flat list.
    const required = screen.getByRole("heading", {
      name: /required to join/iu,
    });
    const recommended = screen.getByRole("heading", { name: /recommended/iu });

    // Queried by role rather than by text: every row repeats its project's name
    // in an sr-only span, so the link's accessible name is not just
    // "View project" and a text query matches twice.

    expect(
      within(groupFor(required)).getByRole("link", {
        name: /required optimisations/iu,
      })
    ).toBeInTheDocument();
    expect(
      within(groupFor(recommended)).getByRole("link", { name: /sodium/iu })
    ).toBeInTheDocument();
  });

  it("says so plainly when a server needs nothing installed", () => {
    render(
      <ServerDetail
        project={{ ...PROJECT, server: { ...SERVER, links: [] } }}
      />
    );

    expect(screen.queryByText(/required to join/iu)).not.toBeInTheDocument();
    expect(
      screen.getByText(/join with a vanilla minecraft client/iu)
    ).toBeInTheDocument();
  });

  it("does not link an unpublished linked project", () => {
    render(
      <ServerDetail
        project={{
          ...PROJECT,
          server: {
            ...SERVER,
            links: [{ ...SERVER.links[0], published: false }],
          },
        }}
      />
    );

    // A link here would 404 for everyone but the owner.
    expect(
      screen.queryByRole("link", { name: /view project/iu })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/not published yet/iu)).toBeInTheDocument();
  });

  it("degrades when the owner has published no address yet", () => {
    render(<ServerDetail project={{ ...PROJECT, server: null }} />);

    expect(
      screen.getByText(/has not published an address/iu)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /copy address/iu })
    ).not.toBeInTheDocument();
  });

  it("shows no versions table and no join section heading", () => {
    render(<ServerDetail project={PROJECT} />);

    // Both belonged to the download page. A server has no files to list, and
    // "Join" was a heading above a panel that is now the page's first column.
    expect(
      screen.queryByRole("heading", { name: /^versions$/iu })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^join$/iu })
    ).not.toBeInTheDocument();
  });

  it("labels the page with a single server heading and its gamemode", () => {
    render(<ServerDetail project={PROJECT} />);

    expect(
      screen.getByRole("heading", { level: 1, name: PROJECT.name })
    ).toBeInTheDocument();
    // The gamemode is what a player filters servers by, so it leads the header
    // the way a project's category does on the download page.
    expect(screen.getByText("Skyblock")).toBeInTheDocument();
  });

  it("never skips a heading level", () => {
    render(<ServerDetail project={PROJECT} />);

    // The panel's requirement groups are `h3`s. Without an `h2` of their own to
    // sit under they jumped from the page's `h1`, which breaks navigation for
    // anyone moving through the page by heading.
    const levels = screen
      .getAllByRole("heading")
      .map((heading) => Number(heading.tagName.slice(1)));

    expect(levels[0]).toBe(1);
    for (const [index, level] of levels.entries()) {
      const previous = levels[index - 1] ?? 1;
      expect(level - previous).toBeLessThanOrEqual(1);
    }
    // And the panel is genuinely there, not an empty heading.
    expect(
      screen.getByRole("heading", { level: 2, name: /join this server/iu })
    ).toBeInTheDocument();
  });

  it("hides the manage link from a visitor who does not own the server", () => {
    render(<ServerDetail project={PROJECT} />);

    expect(
      screen.queryByRole("link", { name: /manage/iu })
    ).not.toBeInTheDocument();
  });

  it("shows the manage link to the owner", () => {
    useSessionMock.mockReturnValue({ data: { user: { id: "user-alice" } } });
    render(<ServerDetail project={PROJECT} />);

    expect(screen.getByRole("link", { name: /manage/iu })).toBeInTheDocument();
  });

  it("marks a draft so its owner knows it is not public", () => {
    render(<ServerDetail project={{ ...PROJECT, status: "draft" }} />);

    expect(screen.getByText(/this server is a draft/iu)).toBeInTheDocument();
  });
});
