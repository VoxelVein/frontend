import type { ReleaseView } from "@/lib/github-releases";

/**
 * Presentation rules for the public changelog. They live apart from the fetch
 * so they can be tested without a network, and apart from the component so the
 * same anchors and categories can be used by the jump list and the badges.
 */

export type ChangelogCategory = "features" | "fixes" | "breaking";

export const CHANGELOG_CATEGORIES = [
  { value: "features", label: "Features" },
  { value: "fixes", label: "Fixes" },
  { value: "breaking", label: "Breaking" },
] as const satisfies readonly {
  value: ChangelogCategory;
  label: string;
}[];

/** Release-note headings, matched case-insensitively after trimming decoration. */
const HEADING_CATEGORIES = new Map<string, ChangelogCategory>([
  ["features", "features"],
  ["feature", "features"],
  ["new features", "features"],
  ["bug fixes", "fixes"],
  ["fixes", "fixes"],
  ["bugfixes", "fixes"],
  ["breaking changes", "breaking"],
  ["breaking", "breaking"],
  ["backwards incompatible", "breaking"],
]);

/**
 * Categories are derived from the notes rather than stored separately: the
 * release body is the source of truth on GitHub, and a second list would drift
 * the moment someone edits a release.
 *
 * A `BREAKING CHANGE` note inside a body counts too, since Conventional
 * Changelog puts those in the body of a commit rather than in a heading.
 */
export const releaseCategories = (body: string): ChangelogCategory[] => {
  const found = new Set<ChangelogCategory>();

  for (const line of body.split(/\r?\n/u)) {
    const heading = /^#{2,6}[ \t]+(?<heading>[^\r\n]*)/u.exec(line)?.groups
      ?.heading;

    if (heading === undefined) {
      continue;
    }

    const key = heading
      .toLowerCase()
      .replaceAll(/[#*:`_]/gu, "")
      .trim();

    const category = HEADING_CATEGORIES.get(key);

    if (category) {
      found.add(category);
    }
  }

  if (/\bbreaking\s+change/iu.test(body)) {
    found.add("breaking");
  }

  return CHANGELOG_CATEGORIES.flatMap((category) =>
    found.has(category.value) ? [category.value] : []
  );
};

/** How many releases carry each tag, for the filter counts. */
export const categoryCounts = (
  releases: readonly ReleaseView[]
): Record<ChangelogCategory, number> => {
  const counts: Record<ChangelogCategory, number> = {
    breaking: 0,
    features: 0,
    fixes: 0,
  };

  for (const release of releases) {
    for (const category of releaseCategories(release.body)) {
      counts[category] += 1;
    }
  }

  return counts;
};

/** One category at a time; `null` is the unfiltered resting state. */
export const releasesInCategory = (
  releases: readonly ReleaseView[],
  category: ChangelogCategory | null
): ReleaseView[] => {
  if (category === null) {
    return [...releases];
  }

  const matches: ReleaseView[] = [];

  for (const release of releases) {
    if (releaseCategories(release.body).some((value) => value === category)) {
      matches.push(release);
    }
  }

  return matches;
};

/** Stable fragment id, safe to use as both an HTML id and a URL fragment. */
export const releaseAnchor = (tag: string): string =>
  `release-${tag.toLowerCase().replaceAll(/[^a-z0-9.-]+/gu, "-")}`;

interface VersionParts {
  major: number;
  minor: number;
}

const parseVersion = (tag: string): VersionParts | null => {
  const [majorText, minorText] = tag.match(/\d+/gu) ?? [];

  return majorText === undefined || minorText === undefined
    ? null
    : { major: Number(majorText), minor: Number(minorText) };
};

export type MilestoneKind = "alpha-prefix" | "breaking" | "major-version";

export interface ChangelogMilestone {
  kind: MilestoneKind;
  /** Visible on the timeline, so a marker is never an unexplained ornament. */
  label: string;
}

/**
 * Markers for the releases that changed the direction of the project.
 *
 * A breaking release is always a milestone. The first `ALPHA-` tag marks the
 * point where the version convention changed, whether or not older untagged
 * releases are present. A jump of two or more minor versions is a major shift
 * even without a breaking heading. When a release qualifies for more than one,
 * the most consequential label wins.
 */
export const milestonesFor = (
  releases: readonly ReleaseView[]
): ReadonlyMap<string, ChangelogMilestone> => {
  const milestones = new Map<string, ChangelogMilestone>();

  if (releases.length === 0) {
    return milestones;
  }

  let firstAlphaPending = true;
  let seenNonAlpha = false;
  let previousVersion: VersionParts | null = null;

  // The API returns newest first; walking oldest first is what makes "the
  // first ALPHA tag" and "the previous version" mean the obvious things.
  for (const release of releases.toReversed()) {
    const isAlpha = /^ALPHA-/iu.test(release.tag);
    const candidates: ChangelogMilestone[] = [];

    if (releaseCategories(release.body).some((value) => value === "breaking")) {
      candidates.push({ kind: "breaking", label: "Breaking changes" });
    }

    if (isAlpha && firstAlphaPending) {
      firstAlphaPending = false;
      candidates.push({
        kind: "alpha-prefix",
        label: seenNonAlpha
          ? "Switched to ALPHA-prefixed releases"
          : "First ALPHA-prefixed release",
      });
    }

    if (!isAlpha) {
      seenNonAlpha = true;
    }

    const version = parseVersion(release.tag);

    if (
      version !== null &&
      previousVersion !== null &&
      version.major === previousVersion.major &&
      version.minor - previousVersion.minor >= 2
    ) {
      candidates.push({
        kind: "major-version",
        label: `Major shift to ${release.tag}`,
      });
    }

    const [chosen] = candidates;

    if (chosen) {
      milestones.set(release.tag, chosen);
    }

    if (version !== null) {
      previousVersion = version;
    }
  }

  return milestones;
};

/**
 * The generated notes open with a `# version (date)` heading, which would
 * duplicate the timeline's own heading and demote every section beneath it.
 * Only that first heading is removed; the rest of the notes are shown verbatim.
 */
export const releaseNotes = (body: string, tag: string): string => {
  const lines = body.split(/\r?\n/u);
  const [first = ""] = lines;

  if (!first.startsWith("# ") || !first.includes(tag)) {
    return body.trim();
  }

  let start = 1;

  while (start < lines.length && lines[start]?.trim() === "") {
    start += 1;
  }

  return lines.slice(start).join("\n").trim();
};
