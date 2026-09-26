import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createProjectSearchCache } from "@/lib/project-search-cache";
import type { ProjectSearchResponse } from "@/lib/project-search.functions";

const responseFixture = (query: string): ProjectSearchResponse => ({
  estimatedTotalHits: 1,
  // oxlint-disable-next-line sonarjs/no-undefined-assignment -- Test fixture mirrors the server response shape
  facetDistribution: undefined,
  hits: [],
  page: 1,
  pageSize: 12,
  query,
});

describe(createProjectSearchCache, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns undefined for a missing key", () => {
    const cache = createProjectSearchCache();

    expect(
      cache.get({
        query: "sodium",
        sort: "downloads:desc",
        type: "mod" as const,
      })
    ).toBeUndefined();
  });

  it("stores and returns a value for the same params", () => {
    const cache = createProjectSearchCache();
    const params = {
      query: "sodium",
      sort: "downloads:desc",
      type: "mod" as const,
    };

    cache.set(params, responseFixture("sodium"));

    expect(cache.get(params)?.query).toBe("sodium");
  });

  it("treats different filter combinations as distinct keys", () => {
    const cache = createProjectSearchCache();
    const base = {
      query: "sodium",
      sort: "downloads:desc",
      type: "mod" as const,
    };

    cache.set(base, responseFixture("sodium"));
    cache.set({ ...base, category: "performance" }, responseFixture("sodium"));

    expect(cache.get(base)?.query).toBe("sodium");
    expect(cache.get({ ...base, category: "performance" })?.query).toBe(
      "sodium"
    );
    expect(cache.get({ ...base, category: "technology" })).toBeUndefined();
  });

  it("keeps pages and project types apart", () => {
    const cache = createProjectSearchCache();
    const base = { query: "", sort: "downloads:desc", type: "mod" as const };

    cache.set(base, responseFixture("page one"));

    expect(cache.get({ ...base, page: 1 })?.query).toBe("page one");
    expect(cache.get({ ...base, page: 2 })).toBeUndefined();
    expect(cache.get({ ...base, type: "plugin" })).toBeUndefined();
  });

  it("expires entries after the TTL", () => {
    const cache = createProjectSearchCache({ ttlMs: 1000 });
    const params = {
      query: "sodium",
      sort: "downloads:desc",
      type: "mod" as const,
    };

    cache.set(params, responseFixture("sodium"));

    vi.advanceTimersByTime(999);
    expect(cache.get(params)).toBeDefined();

    vi.advanceTimersByTime(2);
    expect(cache.get(params)).toBeUndefined();
  });

  it("evicts the least-recently-used entry when at capacity", () => {
    const cache = createProjectSearchCache({ maxEntries: 2 });

    cache.set(
      { query: "a", sort: "downloads:desc", type: "mod" as const },
      responseFixture("a")
    );
    cache.set(
      { query: "b", sort: "downloads:desc", type: "mod" as const },
      responseFixture("b")
    );

    // Touch "a" so "b" becomes the LRU entry.
    cache.get({ query: "a", sort: "downloads:desc", type: "mod" as const });

    cache.set(
      { query: "c", sort: "downloads:desc", type: "mod" as const },
      responseFixture("c")
    );

    expect(
      cache.get({ query: "a", sort: "downloads:desc", type: "mod" as const })
    ).toBeDefined();
    expect(
      cache.get({ query: "b", sort: "downloads:desc", type: "mod" as const })
    ).toBeUndefined();
    expect(
      cache.get({ query: "c", sort: "downloads:desc", type: "mod" as const })
    ).toBeDefined();
  });

  it("delete removes a single entry", () => {
    const cache = createProjectSearchCache();
    const params = {
      query: "sodium",
      sort: "downloads:desc",
      type: "mod" as const,
    };

    cache.set(params, responseFixture("sodium"));
    cache.delete(params);

    expect(cache.get(params)).toBeUndefined();
  });

  it("delete only removes the matching entry", () => {
    const cache = createProjectSearchCache();
    const base = {
      query: "sodium",
      sort: "downloads:desc",
      type: "mod" as const,
    };

    cache.set(base, responseFixture("sodium"));
    cache.set({ ...base, category: "performance" }, responseFixture("sodium"));

    cache.delete(base);

    expect(cache.get(base)).toBeUndefined();
    expect(cache.get({ ...base, category: "performance" })).toBeDefined();
  });

  it("clear removes all entries", () => {
    const cache = createProjectSearchCache();
    const params = {
      query: "sodium",
      sort: "downloads:desc",
      type: "mod" as const,
    };

    cache.set(params, responseFixture("sodium"));
    cache.clear();

    expect(cache.get(params)).toBeUndefined();
  });
});
