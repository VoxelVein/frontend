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
