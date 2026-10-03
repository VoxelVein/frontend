import { describe, expect, it } from "vitest";

import { MINECRAFT_CATEGORIES } from "@/lib/categories";
import {
  CATEGORIES_BY_TYPE,
  LOADERS_BY_TYPE,
  PROJECT_TYPE_DESCRIPTIONS,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPE_PATHS,
  PROJECT_TYPES,
  hasVersions,
} from "@/lib/projects";
import { ALLOWED_EXTENSIONS_BY_TYPE } from "@/lib/upload-validation";

/**
 * Every project type is wired through five parallel registries, and a new type
 * has to land in all of them. The compiler enforces the ones declared with
 * `satisfies Record<ProjectType, …>`, but two of the failures it cannot see are
 * the ones that actually shipped broken: the browse routes existing on disk, and
 * `MINECRAFT_CATEGORIES` agreeing with `PROJECT_TYPE_PATHS`.
 *
 * That second one is how the landing page came to advertise a `Datapack` type
 * that had no browse route while omitting `Servers`. Both registries are keyed
 * differently — `href` by string, `type` by slug — so nothing but this test
 * compares them.
 */
describe("project type registry", () => {
  it("gives every type a singular and plural label", () => {
    for (const type of PROJECT_TYPES) {
      const labels = PROJECT_TYPE_LABELS[type];
      expect(labels.singular, `${type} singular label`).toBeTruthy();
      expect(labels.plural, `${type} plural label`).toBeTruthy();
    }
  });

  it("gives every type at least one category", () => {
    for (const type of PROJECT_TYPES) {
      expect(
        CATEGORIES_BY_TYPE[type].length,
        `${type} categories`
      ).toBeGreaterThan(0);
    }
  });

  it("gives every type a unique lowercase URL path", () => {
    const paths = PROJECT_TYPES.map((type) => PROJECT_TYPE_PATHS[type]);
    for (const path of paths) {
      expect(path, "URL path").toMatch(/^\/[a-z0-9-]+$/u);
    }
    expect(new Set(paths).size).toBe(PROJECT_TYPES.length);
  });

  it("gives every type a browse page description", () => {
    for (const type of PROJECT_TYPES) {
      expect(
        PROJECT_TYPE_DESCRIPTIONS[type],
        `${type} page description`
      ).toBeTruthy();
    }
  });

  it("accepts an upload for every type that ships files", () => {
    for (const type of PROJECT_TYPES) {
      if (!hasVersions(type)) {
        continue;
      }
      expect(
        ALLOWED_EXTENSIONS_BY_TYPE[type].length,
        `${type} allowed extensions`
      ).toBeGreaterThan(0);
    }
  });

  it("keys every registry by exactly the declared types", () => {
    const expected = new Set<string>(PROJECT_TYPES);
    for (const registry of [
      CATEGORIES_BY_TYPE,
      LOADERS_BY_TYPE,
      PROJECT_TYPE_LABELS,
      PROJECT_TYPE_PATHS,
      PROJECT_TYPE_DESCRIPTIONS,
      ALLOWED_EXTENSIONS_BY_TYPE,
    ]) {
      expect(new Set(Object.keys(registry)), "registry keys").toStrictEqual(
        expected
      );
    }
  });
});

describe("MINECRAFT_CATEGORIES against the type registry", () => {
  it("matches the declared project types one for one", () => {
    const fromCategories = MINECRAFT_CATEGORIES.map((entry) => entry.href);
    const fromTypes = PROJECT_TYPES.map((type) => PROJECT_TYPE_PATHS[type]);

    expect(new Set(fromCategories)).toStrictEqual(new Set(fromTypes));
    expect(fromCategories).toHaveLength(PROJECT_TYPES.length);
  });

  it("labels each section exactly as its type is labelled", () => {
    // Compared as href-to-label objects rather than two ordered lists, so this
    // does not assert an ordering the two registries are not required to share,
    // and so a failure names the exact section whose label drifted. The hero
    // derives its rotating headline straight from these labels, which makes a
    // mismatch user-visible on the landing page rather than a naming nit.
    const expected = Object.fromEntries(
      PROJECT_TYPES.map((type) => [
        PROJECT_TYPE_PATHS[type],
        PROJECT_TYPE_LABELS[type].plural,
      ])
    );
    const actual = Object.fromEntries(
      MINECRAFT_CATEGORIES.map((entry) => [entry.href, entry.label])
    );

    expect(actual).toStrictEqual(expected);
  });

  it("keeps every href unique so one path cannot claim two sections", () => {
    const hrefs = MINECRAFT_CATEGORIES.map((entry) => entry.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
