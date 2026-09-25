import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectBrowser } from "@/components/projects/project-browser";
import type { ProjectBrowserData } from "@/lib/project-browser-loader";
import type {
  ProjectSearchParams,
  ProjectSearchResponse,
} from "@/lib/project-search.functions";
import type { ProjectDocument } from "@/lib/projects";

const {
  cacheDeleteMock,
  cacheGetMock,
  cacheSetMock,
  searchModsMock,
  useLoaderDataMock,
} = vi.hoisted(() => ({
  cacheDeleteMock: vi.fn<(params: ProjectSearchParams) => void>(),
  cacheGetMock: vi.fn<() => ProjectSearchResponse | undefined>(),
  cacheSetMock:
    vi.fn<(params: ProjectSearchParams, data: ProjectSearchResponse) => void>(),
  searchModsMock:
    vi.fn<
      (opts: { data: ProjectSearchParams }) => Promise<ProjectSearchResponse>
    >(),
  useLoaderDataMock: vi.fn<() => ProjectBrowserData>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Testing the browser requires a faithful search stub; string path avoids strict factory type-checking against the server function type
vi.mock("@/lib/project-search.functions", () => ({
  searchProjects: searchModsMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The page reads the shared cache singleton; a controllable stub isolates cache behavior in tests
vi.mock("@/lib/project-search-cache", () => ({
  projectSearchCache: {
    delete: cacheDeleteMock,
    get: cacheGetMock,
    set: cacheSetMock,
  },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- ProjectCard is covered by its own rendering; a stub keeps the page test focused on search state
vi.mock("@/components/projects/project-card", () => ({
  ProjectCard: ({ project }: { project: ProjectDocument }) => (
    <div data-testid={`mod-card-${project.id}`}>{project.name}</div>
  ),
}));

const ModsPage = () => <ProjectBrowser type="mod" {...useLoaderDataMock()} />;

// Base UI Select renders a button trigger, so tests must open the popup and
// click the option instead of firing a change event on a native <select>.
// A pointerDown must precede the click so Base UI's mouse-selection guard
// accepts the selection.
const selectCategory = async (value: string) => {
  fireEvent.click(screen.getByLabelText("Category"));
  const option = await screen.findByText(
    value.charAt(0).toUpperCase() + value.slice(1)
  );
  fireEvent.pointerDown(option);
  fireEvent.click(option);
};

interface LiveModEvent {
  event: "mod.created" | "mod.updated" | "mod.deleted";
  data: { id: string; name: string };
}

class EventSourceMock {
  static readonly instances: EventSourceMock[] = [];
  listeners = new Map<string, (event: MessageEvent) => void>();
  closed = false;

  constructor(_url: string) {
    EventSourceMock.instances.push(this);
  }

  addEventListener(
    type: string,
    listener: (event: MessageEvent) => void
  ): void {
    this.listeners.set(type, listener);
  }

  removeEventListener(type: string): void {
    this.listeners.delete(type);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data: LiveModEvent): void {
    const listener = this.listeners.get(type);
    if (listener) {
      // SAFETY: The mock only needs the `data` field; the cast narrows the
      // minimal MessageEvent shape the page's handler reads.
      listener({ data: JSON.stringify(data) } as MessageEvent);
    }
  }
}

const modFixture: ProjectDocument = {
  author: "JellySquid",
  category: "performance",
  description: "A rendering engine replacement.",
  downloads: 14_200_000,
  gameVersions: ["1.21", "1.20.4"],
  id: "sodium",
  loaders: ["fabric", "forge"],
  name: "Sodium",
  slug: "sodium",
  tags: ["rendering"],
  type: "mod",
  updatedAt: "2026-01-01T00:00:00.000Z",
  version: "0.6.0",
};

const responseFixture = (hits: ProjectDocument[]): ProjectSearchResponse => ({
  estimatedTotalHits: hits.length,
  // oxlint-disable-next-line sonarjs/no-undefined-assignment -- Test fixture mirrors the server response shape
  facetDistribution: undefined,
  hits,
  page: 1,
  pageSize: 12,
  query: "",
});

// Reassigned inside the skeleton test to resolve the in-flight search.
let resolveSearch: (value: ProjectSearchResponse) => void = (
  _value: ProjectSearchResponse
) => {};

describe(ProjectBrowser, () => {
  beforeEach(() => {
    EventSourceMock.instances.splice(0);
    cacheDeleteMock.mockReset();
    cacheGetMock.mockReset();
    cacheSetMock.mockReset();
    searchModsMock.mockReset();
    useLoaderDataMock.mockReset();
    useLoaderDataMock.mockReturnValue({ initial: null, initialError: null });
    vi.stubGlobal("EventSource", EventSourceMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders initial results from the loader without a client re-fetch", () => {
    useLoaderDataMock.mockReturnValue({
      initial: responseFixture([modFixture]),
      initialError: null,
    });

    render(<ModsPage />);

    expect(screen.getByRole("heading", { name: "Mods" })).toBeTruthy();
    expect(screen.getByTestId("mod-card-sodium")).toBeTruthy();
    expect(screen.getByText("1 mod found")).toBeTruthy();
    expect(searchModsMock).not.toHaveBeenCalled();
  });

  it("shows skeletons with aria-busy while a search is in flight", async () => {
    searchModsMock.mockReturnValue(
      // oxlint-disable-next-line promise/avoid-new -- A deferred promise is the only way to hold a search in flight and assert the loading state
      new Promise<ProjectSearchResponse>((resolve) => {
        resolveSearch = resolve;
      })
    );

    render(<ModsPage />);

    await selectCategory("performance");

    const busyRegion = await screen.findByLabelText("Search mods");
    expect(busyRegion).toBeTruthy();

    // The results region is not rendered yet; skeletons are shown instead.
    expect(screen.queryByTestId("mod-card-sodium")).toBeNull();

    resolveSearch(responseFixture([modFixture]));
    await waitFor(() => {
      expect(screen.getByTestId("mod-card-sodium")).toBeTruthy();
    });
  });

  it("shows the empty state with a clear-filters action", async () => {
    searchModsMock.mockResolvedValue(responseFixture([]));

    render(<ModsPage />);

    await selectCategory("performance");

    await waitFor(() => {
      expect(screen.getByText("No mods found")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Category")).toHaveValue("");
    });
  });

  it("shows an error with a retry button and recovers on retry", async () => {
    searchModsMock.mockRejectedValueOnce(new Error("Search failed"));

    render(<ModsPage />);

    await selectCategory("performance");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Search failed");
    });

    searchModsMock.mockResolvedValueOnce(responseFixture([modFixture]));

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(screen.getByTestId("mod-card-sodium")).toBeTruthy();
    });
  });

  it("shows an actionable message when the search service is unreachable", async () => {
    searchModsMock.mockRejectedValueOnce(new Error("fetch failed"));

    render(<ModsPage />);

    await selectCategory("performance");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not reach the search service"
      );
    });
  });

  it("searches immediately as the query changes (real-time)", async () => {
    searchModsMock.mockResolvedValue(responseFixture([modFixture]));

    render(<ModsPage />);

    fireEvent.change(screen.getByLabelText("Search mods"), {
      target: { value: "sodium" },
    });

    await waitFor(() => {
      expect(searchModsMock).toHaveBeenCalledWith({
        data: expect.objectContaining({ query: "sodium" }),
      });
    });
  });

  it("shows a live-event banner and refreshes results on demand", async () => {
    searchModsMock.mockResolvedValue(responseFixture([modFixture]));

    render(<ModsPage />);

    const [source] = EventSourceMock.instances;
    expect(source).toBeTruthy();

    source.emit("mod.created", {
      data: { id: "new-mod", name: "New Mod" },
      event: "mod.created",
    });

    await expect(screen.findByText(/New mod added/u)).resolves.toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Refresh results" }));

    await waitFor(() => {
      expect(cacheDeleteMock).toHaveBeenCalledWith(
        expect.objectContaining({ query: "" })
      );
    });
    expect(searchModsMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ query: "" }),
    });
  });

  it("serves cached results without calling the search function", async () => {
    cacheGetMock.mockReturnValue(responseFixture([modFixture]));

    render(<ModsPage />);

    await selectCategory("performance");

    await waitFor(() => {
      expect(screen.getByTestId("mod-card-sodium")).toBeTruthy();
    });
    expect(searchModsMock).not.toHaveBeenCalled();
  });

  it("adapts labels and search params to plugins", async () => {
    searchModsMock.mockResolvedValue(responseFixture([]));

    render(<ProjectBrowser type="plugin" initial={null} initialError={null} />);

    expect(screen.getByRole("heading", { name: "Plugins" })).toBeTruthy();
    expect(screen.getByLabelText("Platform")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search plugins"), {
      target: { value: "claims" },
    });

    await waitFor(() => {
      expect(searchModsMock).toHaveBeenCalledWith({
        data: expect.objectContaining({ query: "claims", type: "plugin" }),
      });
    });
  });
});
