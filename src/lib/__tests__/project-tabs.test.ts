import { describe, expect, it } from "vitest";

import {
  parseProjectSearch,
  PROJECT_TABS,
  resolveProjectTab,
} from "@/lib/project-tabs";

/** Parses a real query string rather than hand-building the parsed shape. */
const search = (query: string) =>
  parseProjectSearch(Object.fromEntries(new URLSearchParams(query)));

const resolveTabFrom = (query: string) => resolveProjectTab(search(query));

describe(resolveProjectTab, () => {
  it("lands on Details with no parameters at all", () => {
    expect(resolveTabFrom("")).toBe("details");
  });

  it("honours every tab that has a panel", () => {
    for (const { value } of PROJECT_TABS) {
      expect(resolveTabFrom(`tab=${value}`)).toBe(value);
    }
  });

  it("only ever resolves to a tab that has a panel", () => {
    // A name the schema accepts but no panel renders would leave the editor
    // looking empty instead of reporting an error.
    for (const name of ["details", "images", "versions", "danger"]) {
      expect(PROJECT_TABS.map(({ value }) => value)).toContain(
        resolveTabFrom(`tab=${name}`)
      );
    }
  });
});

describe(parseProjectSearch, () => {
  it("defaults the tab to absent", () => {
    expect(search("")).toStrictEqual({});
  });

  it("rejects an unknown tab instead of silently falling back", () => {
    // The route's validateSearch throws, so a bad link becomes a visible
    // router error rather than a blank editor.
    expect(() => search("tab=admin")).toThrow(/received "admin"/u);
  });
});
