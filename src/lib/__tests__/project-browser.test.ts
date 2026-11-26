import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  buildSearchParams,
  DEFAULT_SORT,
  LIVE_EVENT_TYPES,
  parseLiveEvent,
  SORT_OPTIONS,
  sortOptionsFor,
  totalPagesFor,
  searchHintFor,
} from "@/lib/project-browser";
import type { ProjectBrowserFilterValues } from "@/lib/project-browser";
import type { ProjectSearchResponse } from "@/lib/project-search.functions";
import { PROJECT_TYPES } from "@/lib/projects";
import type { ProjectType } from "@/lib/projects";

const FILTER_KEYS = [
  "category",
  "clientRequirement",
  "gameVersion",
  "loader",
  "query",
] as const satisfies readonly (keyof ProjectBrowserFilterValues)[];

const responseWith = (
  estimatedTotalHits: number,
  pageSize: number
): ProjectSearchResponse => ({
  estimatedTotalHits,
  pageSize,
  hits: [],
  page: 1,
  query: "",
  facetDistribution: null,
});

const sortValuesFor = (type: ProjectType) =>
  sortOptionsFor(type).map((option) => option.value);

describe(sortOptionsFor, () => {
  it("offers voting only where votes exist", () => {
    expect(sortValuesFor("server")).toContain("votes:desc");
    expect(sortValuesFor("mod")).not.toContain("votes:desc");
  });

  it("keeps the default sort available for every project type", () => {
    for (const type of PROJECT_TYPES) {
      expect(
        sortOptionsFor(type).some((option) => option.value === DEFAULT_SORT)
      ).toBeTruthy();
    }
  });

  it("labels every option it offers", () => {
    for (const type of PROJECT_TYPES) {
      for (const option of sortOptionsFor(type)) {
        expect(option.label.length).toBeGreaterThan(0);
        expect(
          SORT_OPTIONS.some((entry) => entry.value === option.value)
        ).toBeTruthy();
      }
    }
  });
});

describe(buildSearchParams, () => {
  it("carries every filter and the page into one request", () => {
    expect(
      buildSearchParams({
        category: "performance",
        clientRequirement: "optional",
        gameVersion: "1.21",
        loader: "fabric",
        page: 2,
        query: "sodium",
        sort: "updatedAt:desc",
        type: "mod",
      })
    ).toStrictEqual({
      category: "performance",
      clientRequirement: "optional",
      gameVersion: "1.21",
      loader: "fabric",
      page: 2,
      query: "sodium",
      sort: "updatedAt:desc",
      type: "mod",
    });
  });

  it("keeps an untouched panel explicit rather than dropping fields", () => {
    expect(
      buildSearchParams({
        category: "",
        clientRequirement: "",
        gameVersion: "",
        loader: "",
        page: 1,
        query: "",
        sort: DEFAULT_SORT,
        type: "server",
      })
    ).toStrictEqual({
      category: "",
      clientRequirement: "",
      gameVersion: "",
      loader: "",
      page: 1,
      query: "",
      sort: DEFAULT_SORT,
      type: "server",
    });
  });
});

describe(activeFilterCount, () => {
  it("is zero for an untouched panel", () => {
    expect(
      activeFilterCount({
        category: "",
        clientRequirement: "",
        gameVersion: "",
        loader: "",
        query: "",
      })
    ).toBe(0);
  });

  it("counts each filter on its own", () => {
    const empty = {
      category: "",
      clientRequirement: "",
      gameVersion: "",
      loader: "",
      query: "",
    };

    for (const key of FILTER_KEYS) {
      expect(activeFilterCount({ ...empty, [key]: "set" })).toBe(1);
    }
  });

  it("counts every filter when they are all set", () => {
    expect(
      activeFilterCount({
        category: "performance",
        clientRequirement: "optional",
        gameVersion: "1.21",
        loader: "fabric",
        query: "sodium",
      })
    ).toBe(5);
  });
});

describe(totalPagesFor, () => {
  it("is one page before a result arrives", () => {
    expect(totalPagesFor(null)).toBe(1);
  });

  it("is one page for an empty result", () => {
    expect(totalPagesFor(responseWith(0, 12))).toBe(1);
  });

  it("rounds a partial page up", () => {
    expect(totalPagesFor(responseWith(25, 12))).toBe(3);
  });

  it("does not add a page for an exact multiple", () => {
    expect(totalPagesFor(responseWith(24, 12))).toBe(2);
  });
});

describe(searchHintFor, () => {
  it("names the loader field for a mod", () => {
    expect(searchHintFor("mod")).toBe(
      "Search mods by name, category, game version and loader."
    );
  });

  it("uses the platform wording for a plugin", () => {
    expect(searchHintFor("plugin")).toBe(
      "Search plugins by name, category, game version and platform."
    );
  });

  it("omits loaders for a type that has none", () => {
    const hint = searchHintFor("datapack");

    expect(hint).toBe("Search datapacks by name, category and game version.");
    expect(hint).not.toContain("loader");
  });

  it("mentions the client requirement for a server", () => {
    expect(searchHintFor("server")).toBe(
      "Search servers by name, category, game version and client requirement."
    );
  });
});

describe(parseLiveEvent, () => {
  it("accepts every stream event", () => {
    for (const event of LIVE_EVENT_TYPES) {
      expect(
        parseLiveEvent(
          JSON.stringify({ data: { id: "project-1", name: "Sodium" }, event })
        )
      ).toStrictEqual({
        data: { id: "project-1", name: "Sodium" },
        event,
      });
    }
  });

  it("ignores malformed JSON", () => {
    expect(parseLiveEvent("{not json")).toBeNull();
  });

  it("ignores an unknown event type", () => {
    expect(
      parseLiveEvent(
        JSON.stringify({
          data: { id: "project-1", name: "Sodium" },
          event: "mod.archived",
        })
      )
    ).toBeNull();
  });

  it("ignores a frame without a usable project", () => {
    expect(
      parseLiveEvent(JSON.stringify({ data: { id: 1 }, event: "mod.created" }))
    ).toBeNull();
    expect(
      parseLiveEvent(JSON.stringify({ data: null, event: "mod.created" }))
    ).toBeNull();
    expect(parseLiveEvent(JSON.stringify(null))).toBeNull();
  });
});
