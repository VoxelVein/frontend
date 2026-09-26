import type { Settings } from "meilisearch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IndexablePost } from "@/lib/posts-index";
import {
  flushReindex,
  resetReindexQueue,
  scheduleReindex,
  scheduleReindexDelete,
  toSearchDocument,
  withIndex,
} from "@/lib/posts-index";
import type { PostSearchDocument } from "@/lib/posts-search";

/** Minimal stand-in for the task Meilisearch enqueues. */
interface Task {
  taskUid: number;
}

interface CreateIndexOptions {
  primaryKey: string;
}

interface SearchOptions {
  filter?: string[];
  limit?: number;
  sort?: string[];
}

interface SearchResult {
  estimatedTotalHits: number;
  hits: PostSearchDocument[];
  query: string;
}

const {
  addDocuments,
  createIndex,
  deleteDocuments,
  envMock,
  meilisearchStub,
  search,
  updateSettings,
} = vi.hoisted(() => {
  const addDocumentsMock =
    vi.fn<(docs: PostSearchDocument[]) => Promise<Task>>();
  const createIndexMock =
    vi.fn<(uid: string, options?: CreateIndexOptions) => Promise<Task>>();
  const deleteDocumentsMock = vi.fn<(ids: string[]) => Promise<Task>>();
  const searchMock =
    vi.fn<(query: string, options?: SearchOptions) => Promise<SearchResult>>();
  const updateSettingsMock = vi.fn<(settings: Settings) => Promise<Task>>();

  // A constructible stub, because the module under test calls
  // `new Meilisearch(...)`. Neither obvious alternative works: a class needs an
  // `index` member, which trips class-methods-use-this, and an inline named
  // function expression trips sonarjs/function-name.
  const buildClient = function buildClient() {
    return {
      createIndex: createIndexMock,
      index: () => ({
        addDocuments: addDocumentsMock,
        deleteDocuments: deleteDocumentsMock,
        search: searchMock,
        updateSettings: updateSettingsMock,
      }),
    };
  };

  return {
    addDocuments: addDocumentsMock,
    createIndex: createIndexMock,
    deleteDocuments: deleteDocumentsMock,
    envMock: {
      MEILI_HOST: "http://localhost:7700",
      MEILI_ADMIN_KEY: "test-admin-key",
    },
    meilisearchStub: buildClient,
    search: searchMock,
    updateSettings: updateSettingsMock,
  };
});

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Exercises the real debounce and batching logic, which only needs the Meilisearch client surface stubbed
vi.mock("meilisearch", () => ({ Meilisearch: meilisearchStub }));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The real env.config throws when MEILI_ADMIN_KEY is read in the jsdom test env, so it needs a mutable stand-in
vi.mock("../../../env.config", () => ({ default: envMock }));

const enqueued: Task = { taskUid: 1 };

const postFixture = (
  overrides: Partial<IndexablePost> = {}
): IndexablePost => ({
  content: "## Heading\n\nSome body text worth indexing.",
  createdAt: new Date("2026-01-15T10:30:00.000Z"),
  excerpt: null,
  id: "post-1",
  published: true,
  slug: "some-body-text",
  title: "Some body text",
  updatedAt: new Date("2026-02-20T08:00:00.000Z"),
  ...overrides,
});

describe("posts index", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    envMock.MEILI_HOST = "http://localhost:7700";
    envMock.MEILI_ADMIN_KEY = "test-admin-key";
    addDocuments.mockClear().mockResolvedValue(enqueued);
    createIndex.mockClear().mockResolvedValue(enqueued);
    deleteDocuments.mockClear().mockResolvedValue(enqueued);
    search.mockClear().mockResolvedValue({
      estimatedTotalHits: 0,
      hits: [],
      query: "",
    });
    updateSettings.mockClear().mockResolvedValue(enqueued);
  });

  afterEach(() => {
    resetReindexQueue();
    vi.useRealTimers();
  });

  describe(toSearchDocument, () => {
    it("maps a post into a Meilisearch document", () => {
      expect(toSearchDocument(postFixture())).toStrictEqual({
        content: "## Heading\n\nSome body text worth indexing.",
        createdAt: "2026-01-15T10:30:00.000Z",
        createdAtTs: Date.parse("2026-01-15T10:30:00.000Z"),
        excerpt: null,
        id: "post-1",
        preview: "Heading Some body text worth indexing.",
        published: true,
        slug: "some-body-text",
        title: "Some body text",
        updatedAt: "2026-02-20T08:00:00.000Z",
      });
    });

    it("derives the preview from the body when no excerpt is set", () => {
      const doc = toSearchDocument(postFixture({ excerpt: null }));

      expect(doc.preview).toBe("Heading Some body text worth indexing.");
    });

    it("prefers a manual excerpt for the preview", () => {
      const doc = toSearchDocument(postFixture({ excerpt: "Hand written." }));

      expect(doc.preview).toBe("Hand written.");
    });

    it("converts an ISO string timestamp to epoch milliseconds", () => {
      const doc = toSearchDocument(
        postFixture({ createdAt: "2026-03-01T00:00:00.000Z" })
      );

      expect(doc.createdAtTs).toBe(Date.parse("2026-03-01T00:00:00.000Z"));
    });
  });

  describe(scheduleReindex, () => {
    it("waits for the debounce window before writing", async () => {
      scheduleReindex(postFixture());
      await vi.advanceTimersByTimeAsync(200);
      expect(addDocuments).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(400);
      expect(addDocuments).toHaveBeenCalledOnce();
    });

    it("coalesces repeated writes to the same post into one document", async () => {
      scheduleReindex(postFixture({ title: "First" }));
      scheduleReindex(postFixture({ title: "Second" }));
      scheduleReindex(postFixture({ title: "Third" }));
      await vi.advanceTimersByTimeAsync(600);

      expect(addDocuments).toHaveBeenCalledOnce();
      const [[docs]] = addDocuments.mock.calls;
      expect(docs).toHaveLength(1);
      expect(docs[0].title).toBe("Third");
    });

    it("batches distinct posts into a single task", async () => {
      scheduleReindex(postFixture({ id: "a", slug: "a" }));
      scheduleReindex(postFixture({ id: "b", slug: "b" }));
      await vi.advanceTimersByTimeAsync(600);

      expect(addDocuments).toHaveBeenCalledOnce();
      const [[docs]] = addDocuments.mock.calls;
      // Order-independent: the queue preserves insertion order, but the point
      // here is that both posts made it into the same batch.
      const ids = docs.map((doc) => doc.id);
      expect(ids).toHaveLength(2);
      expect(ids).toContain("a");
      expect(ids).toContain("b");
    });
  });

  describe(scheduleReindexDelete, () => {
    it("removes the document from the index", async () => {
      scheduleReindexDelete("post-9");
      await vi.advanceTimersByTimeAsync(600);

      expect(deleteDocuments).toHaveBeenCalledWith(["post-9"]);
      expect(addDocuments).not.toHaveBeenCalled();
    });

    it("drops a pending upsert for the same id", async () => {
      scheduleReindex(postFixture());
      scheduleReindexDelete("post-1");
      await vi.advanceTimersByTimeAsync(600);

      expect(addDocuments).not.toHaveBeenCalled();
      expect(deleteDocuments).toHaveBeenCalledWith(["post-1"]);
    });

    it("treats an upsert after a delete as an upsert", async () => {
      scheduleReindexDelete("post-1");
      scheduleReindex(postFixture());
      await vi.advanceTimersByTimeAsync(600);

      expect(deleteDocuments).not.toHaveBeenCalled();
      expect(addDocuments).toHaveBeenCalledOnce();
    });
  });

  describe(flushReindex, () => {
    it("writes immediately without waiting for the debounce window", async () => {
      scheduleReindex(postFixture());
      await flushReindex();

      expect(addDocuments).toHaveBeenCalledOnce();
    });
  });

  describe("search availability", () => {
    it("returns null from withIndex when no admin key is configured", async () => {
      envMock.MEILI_ADMIN_KEY = "";

      await expect(
        withIndex(() => Promise.resolve("never"))
      ).resolves.toBeNull();
      expect(createIndex).not.toHaveBeenCalled();
    });

    it("returns null from withIndex when Meilisearch throws", async () => {
      await expect(
        withIndex(() => Promise.reject(new Error("down")))
      ).resolves.toBeNull();
    });

    it("passes the result through when the work succeeds", async () => {
      await expect(withIndex(() => Promise.resolve("ok"))).resolves.toBe("ok");
    });
  });
});
