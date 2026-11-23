import {
  getReleasesInLine,
  RELEASE_GAME_VERSIONS,
} from "@/lib/minecraft-versions";
import { GAME_VERSIONS } from "@/lib/projects";

/** Longest list rendered at once; typing narrows it further. */
export const MAX_VISIBLE_VERSIONS = 150;

// Options that stand for a whole release line, e.g. "line:1.20".
export const LINE_PREFIX = "line:";
const LINE_QUERY = /^(?<line>\d+\.\d+)(?:\.x?)?$/u;

/** Puts known ids newest first, the way Mojang lists them. */
export const newestFirst = (ids: Iterable<string>): string[] => {
  const chosen = new Set(ids);

  return GAME_VERSIONS.filter((id) => chosen.has(id));
};

const lineOption = (line: string) => `${LINE_PREFIX}${line}`;

export type VersionSelectionInput =
  | { kind: "not-selection" }
  | { kind: "invalid"; message: string }
  | { kind: "valid"; versions: string[] };

export const getAllGameVersions = (includeSnapshots: boolean): string[] => [
  ...(includeSnapshots ? GAME_VERSIONS : RELEASE_GAME_VERSIONS),
];

/** Expand `*` or an inclusive catalog range such as `1.21.1-26.3`. */
export const resolveVersionSelectionInput = (
  input: string,
  includeSnapshots: boolean
): VersionSelectionInput => {
  const value = input.trim();
  const pool = getAllGameVersions(includeSnapshots);

  if (value === "*") {
    return { kind: "valid", versions: [...pool] };
  }

  const range =
    /^(?<start>\d+(?:\.\d+){1,2})\s*-\s*(?<end>\d+(?:\.\d+){1,2})$/u.exec(
      value
    );

  const startVersion = range?.groups?.start;
  const endVersion = range?.groups?.end;

  if (!startVersion || !endVersion) {
    return { kind: "not-selection" };
  }

  const start = pool.indexOf(startVersion);
  const end = pool.indexOf(endVersion);

  if (start === -1 || end === -1) {
    return {
      kind: "invalid",
      message: "Both ends of the range must be available game versions.",
    };
  }

  return {
    kind: "valid",
    versions: pool.slice(Math.min(start, end), Math.max(start, end) + 1),
  };
};

/**
 * The options for a query: matching versions, newest first, and a shortcut
 * for the whole line when the query names one (`1.20` → "All 1.20.x").
 */
export const filterGameVersions = (
  query: string,
  includeSnapshots: boolean,
  withLineShortcut = true
): string[] => {
  const needle = query.trim().toLowerCase();
  const pool = includeSnapshots ? GAME_VERSIONS : RELEASE_GAME_VERSIONS;

  const matches = needle
    ? pool.filter((id) => id.toLowerCase().includes(needle))
    : [...pool];

  // Versions that start with the query are what people mean by "1.20".
  const ranked = [
    ...matches.filter((id) => id.toLowerCase().startsWith(needle)),
    ...matches.filter((id) => !id.toLowerCase().startsWith(needle)),
  ];

  const line = LINE_QUERY.exec(needle)?.groups?.line;

  const shortcut =
    withLineShortcut && line && getReleasesInLine(line).length > 1
      ? [lineOption(line)]
      : [];

  return [...shortcut, ...ranked].slice(0, MAX_VISIBLE_VERSIONS);
};
