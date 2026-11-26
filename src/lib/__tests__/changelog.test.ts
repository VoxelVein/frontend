import { describe, expect, it } from "vitest";

import {
  categoryCounts,
  milestonesFor,
  releaseAnchor,
  releaseCategories,
  releaseNotes,
  releasesInCategory,
} from "@/lib/changelog";
import type { ReleaseView } from "@/lib/github-releases";

const release = (
  tag: string,
  body: string,
  overrides: Partial<ReleaseView> = {}
): ReleaseView => ({
  body,
  htmlUrl: `https://github.com/VoxelVein/frontend/releases/tag/${tag}`,
  name: tag,
  publishedAt: "2026-11-26T00:00:00Z",
  tag,
  ...overrides,
});

describe("release categories", () => {
  it("reads Conventional Changelog headings", () => {
    expect(
      releaseCategories(
        "# ALPHA-1.0.0\n\n### Features\n\n* new\n\n### Bug Fixes\n\n* old"
      )
    ).toStrictEqual(["features", "fixes"]);
  });

  it("treats a breaking-change note as breaking even without a heading", () => {
    expect(
      releaseCategories("### Features\n\n* BREAKING CHANGE: moved the API")
    ).toStrictEqual(["features", "breaking"]);
  });

  it("returns the declared order regardless of heading order", () => {
    expect(
      releaseCategories("### Bug Fixes\n\n* a\n\n### Features\n\n* b")
    ).toStrictEqual(["features", "fixes"]);
  });

  it("returns nothing for notes with no recognized sections", () => {
    expect(releaseCategories("### Documentation\n\n* docs")).toStrictEqual([]);
  });

  it("ignores a heading-like line inside a code fence's prose", () => {
    // Only ATX headings at the start of a line count; an indented example
    // should not tag a release as having features it does not have.
    expect(releaseCategories("  ### Features\n\n* docs")).toStrictEqual([]);
  });
});

describe("category filtering", () => {
  const releases = [
    release("ALPHA-2.0.0", "### Features\n\n* new"),
    release("ALPHA-1.1.0", "### Bug Fixes\n\n* old"),
    release("ALPHA-1.0.0", "### Features\n\n* a\n\n### Bug Fixes\n\n* b"),
  ];

  it("counts a release once per category", () => {
    expect(categoryCounts(releases)).toStrictEqual({
      breaking: 0,
      features: 2,
      fixes: 2,
    });
  });

  it("keeps a copy of the full list when unfiltered", () => {
    const all = releasesInCategory(releases, null);

    expect(all).toHaveLength(3);
    expect(all).not.toBe(releases);
  });

  it("returns only releases carrying the chosen tag", () => {
    expect(
      releasesInCategory(releases, "features").map((entry) => entry.tag)
    ).toStrictEqual(["ALPHA-2.0.0", "ALPHA-1.0.0"]);
  });

  it("returns nothing for a category nobody used", () => {
    expect(releasesInCategory(releases, "breaking")).toStrictEqual([]);
  });
});

describe("release anchors", () => {
  it("is stable and safe as a URL fragment", () => {
    expect(releaseAnchor("ALPHA-0.18.0")).toBe("release-alpha-0.18.0");
    expect(releaseAnchor("Alpha 0.17.0")).toBe("release-alpha-0.17.0");
  });

  it("does not collide for different versions", () => {
    expect(releaseAnchor("ALPHA-0.18.0")).not.toBe(
      releaseAnchor("ALPHA-0.18.1")
    );
  });
});

describe("timeline milestones", () => {
  it("marks the first ALPHA-prefixed release", () => {
    const milestones = milestonesFor([
      release("ALPHA-0.18.0", "### Features\n\n* new"),
      release("ALPHA-0.17.0", "### Features\n\n* first"),
    ]);

    expect(milestones.get("ALPHA-0.17.0")).toStrictEqual({
      kind: "alpha-prefix",
      label: "First ALPHA-prefixed release",
    });
    expect(milestones.has("ALPHA-0.18.0")).toBeFalsy();
  });

  it("describes the switch when older untagged releases are present", () => {
    const milestones = milestonesFor([
      release("ALPHA-0.10.2", "### Features\n\n* first"),
      release("0.9.0", "### Features\n\n* older"),
    ]);

    expect(milestones.get("ALPHA-0.10.2")?.label).toBe(
      "Switched to ALPHA-prefixed releases"
    );
  });

  it("prefers a breaking label over the prefix and version-jump labels", () => {
    const milestones = milestonesFor([
      release("ALPHA-1.0.0", "### BREAKING CHANGES\n\n* removed"),
      release("ALPHA-0.10.2", "### Features\n\n* first"),
    ]);

    expect(milestones.get("ALPHA-1.0.0")).toStrictEqual({
      kind: "breaking",
      label: "Breaking changes",
    });
  });

  it("marks a jump of two or more minor versions as a major shift", () => {
    const milestones = milestonesFor([
      release("ALPHA-0.15.0", "### Features\n\n* new"),
      release("ALPHA-0.12.1", "### Features\n\n* first"),
    ]);

    expect(milestones.get("ALPHA-0.15.0")?.kind).toBe("major-version");
  });

  it("does not mark a patch or single-minor bump", () => {
    const milestones = milestonesFor([
      release("ALPHA-0.16.1", "### Bug Fixes\n\n* patch"),
      release("ALPHA-0.15.0", "### Features\n\n* first"),
    ]);

    expect(milestones.has("ALPHA-0.16.1")).toBeFalsy();
  });

  it("returns an empty map when there are no releases", () => {
    expect(milestonesFor([]).size).toBe(0);
  });
});

describe("release notes", () => {
  it("drops the duplicated version heading and keeps the sections", () => {
    const body = "# ALPHA-0.18.0 (2026-11-26)\n\n### Features\n\n* new";

    expect(releaseNotes(body, "ALPHA-0.18.0")).toBe("### Features\n\n* new");
  });

  it("leaves notes without a leading heading alone", () => {
    expect(releaseNotes("### Features\n\n* new", "ALPHA-0.18.0")).toBe(
      "### Features\n\n* new"
    );
  });

  it("keeps a heading that belongs to a different version", () => {
    const body = "# ALPHA-0.17.0 (2026-11-24)\n\n### Features\n\n* new";

    expect(releaseNotes(body, "ALPHA-0.18.0")).toBe(body);
  });
});
