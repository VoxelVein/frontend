import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectBrowser } from "@/components/projects/project-browser";
import { formatCategory } from "@/lib/format";
import type { ProjectBrowserData } from "@/lib/project-browser-loader";
import type {
  ProjectSearchParams,
  ProjectSearchResponse,
} from "@/lib/project-search.functions";
import type { ProjectDocument } from "@/lib/projects";

interface ToastCallOptions {
  id?: string;
}

const {
  cacheDeleteMock,
  cacheGetMock,
  cacheSetMock,
  searchModsMock,
  toastErrorMock,
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
  toastErrorMock:
    vi.fn<(message: string, options?: ToastCallOptions) => void>(),
  useLoaderDataMock: vi.fn<() => ProjectBrowserData>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Server failures are announced by Sonner; stubbing it makes the toast assertable
vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: vi.fn<() => void>(),
    dismiss: vi.fn<() => void>(),
  },
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

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The server-status query pulls in the database; this suite is about browser search state
vi.mock("@/lib/server-status.functions", () => ({
  getMinecraftServerStatuses: vi.fn<
    (opts: { data: { projectIds: string[] } }) => Promise<Record<string, never>>
  >(() => Promise.resolve({})),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- ProjectCard is covered by its own rendering; a stub keeps the page test focused on search state
vi.mock("@/components/projects/project-card", () => ({
  ProjectCard: ({ project }: { project: ProjectDocument }) => (
    <div data-testid={`mod-card-${project.id}`}>{project.name}</div>
  ),
}));

// The results region reads server status through TanStack Query, so it needs a
// provider even when the query is disabled for non-server project types.
const renderPage = (ui: ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

const ModsPage = () => <ProjectBrowser type="mod" {...useLoaderDataMock()} />;

// Base UI Select renders a button trigger, so tests must open the popup and
// click the option instead of firing a change event on a native <select>.
// A pointerDown must precede the click so Base UI's mouse-selection guard
// accepts the selection.
const selectCategory = async (value: string) => {
  fireEvent.click(screen.getByLabelText("Category"));
  // The real formatter, not a local re-implementation: the option label is
  // rendered by `formatCategory`, so a copy of its logic here would drift.
  const option = await screen.findByText(formatCategory(value));
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
  authorUsername: "jellysquid",
  category: "performance",
  description: "A rendering engine replacement.",
  downloads: 14_200_000,
  gallery: [],
  gameVersions: ["1.21", "1.20.4"],
  icon: null,
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
  hits,
  estimatedTotalHits: hits.length,
  // oxlint-disable-next-line sonarjs/no-undefined-assignment -- Test fixture mirrors the server response shape
  facetDistribution: null,
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
    toastErrorMock.mockReset();
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

    renderPage(<ModsPage />);

    expect(screen.getByRole("heading", { name: "Mods" })).toBeInTheDocument();
    expect(screen.getByTestId("mod-card-sodium")).toBeInTheDocument();
    expect(screen.getByText("1 mod found")).toBeInTheDocument();
    expect(searchModsMock).not.toHaveBeenCalled();
  });

  it("shows skeletons with aria-busy while a search is in flight", async () => {
    searchModsMock.mockReturnValue(
      // oxlint-disable-next-line promise/avoid-new -- A deferred promise is the only way to hold a search in flight and assert the loading state
      new Promise<ProjectSearchResponse>((resolve) => {
        resolveSearch = resolve;
      })
    );

    renderPage(<ModsPage />);

    await selectCategory("performance");

    const busyRegion = await screen.findByLabelText("Search mods");
    expect(busyRegion).toBeTruthy();

    // The results region is not rendered yet; skeletons are shown instead.
    expect(screen.queryByTestId("mod-card-sodium")).toBeNull();

    resolveSearch(responseFixture([modFixture]));
    await waitFor(() => {
      expect(screen.queryByTestId("mod-card-sodium")).toBeInTheDocument();
    });
  });

  it("shows the empty state with a clear-filters action", async () => {
    searchModsMock.mockResolvedValue(responseFixture([]));

    renderPage(<ModsPage />);

    await selectCategory("performance");

    await waitFor(() => {
      expect(screen.queryByText("No mods found")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Category")).toHaveValue("");
    });
  });

  it("shows an error with a retry button and recovers on retry", async () => {
    searchModsMock.mockRejectedValueOnce(new Error("Search failed"));

    renderPage(<ModsPage />);

    await selectCategory("performance");

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringContaining("Search failed"),
        expect.any(Object)
      );
    });

    searchModsMock.mockResolvedValueOnce(responseFixture([modFixture]));

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(screen.queryByTestId("mod-card-sodium")).toBeInTheDocument();
    });
  });

  it("explains a refused database connection", async () => {
    searchModsMock.mockRejectedValueOnce(
      new Error("connect ECONNREFUSED 127.0.0.1:5432")
    );

    renderPage(<ModsPage />);

    await selectCategory("performance");

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringContaining("Could not reach the database"),
        expect.any(Object)
      );
    });
  });

  it("distinguishes a failed browser→server call from a database outage", async () => {
    // The browser reaches the query through a fetch to the app's own server;
    // "failed to fetch" means that hop broke, not that Postgres is down.
    searchModsMock.mockRejectedValueOnce(new Error("Failed to fetch"));

    renderPage(<ModsPage />);

    await selectCategory("performance");

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringContaining("Could not reach the server"),
        expect.any(Object)
      );
    });
  });

  it("searches immediately as the query changes (real-time)", async () => {
    searchModsMock.mockResolvedValue(responseFixture([modFixture]));

    renderPage(<ModsPage />);

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

    renderPage(<ModsPage />);

    const [source] = EventSourceMock.instances;
    expect(source).toBeTruthy();

    source.emit("mod.created", {
      data: { id: "new-mod", name: "New Mod" },
      event: "mod.created",
    });

    await expect(screen.findByText(/New project added/u)).resolves.toBeTruthy();

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

    renderPage(<ModsPage />);

    await selectCategory("performance");

    await waitFor(() => {
      expect(screen.queryByTestId("mod-card-sodium")).toBeInTheDocument();
    });
    expect(searchModsMock).not.toHaveBeenCalled();
  });

  it("adapts labels and search params to plugins", async () => {
    searchModsMock.mockResolvedValue(responseFixture([]));

    renderPage(
      <ProjectBrowser type="plugin" initial={null} initialError={null} />
    );

    expect(
      screen.getByRole("heading", { name: "Plugins" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Platform")).toBeInTheDocument();

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
