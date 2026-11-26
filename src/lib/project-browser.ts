import { object, picklist, safeParse, string } from "valibot";
import type { InferOutput } from "valibot";

import type {
  ProjectSearchParams,
  ProjectSearchResponse,
} from "@/lib/project-search.functions";
import { hasLoaders, LOADER_LABELS, PROJECT_TYPE_LABELS } from "@/lib/projects";
import type { ProjectType } from "@/lib/projects";

/**
 * Pure search state for the browse pages.
 *
 * The component previously carried a copy of every sort list, filter count and
 * page calculation. Keeping them here makes the rules testable without a
 * browser and gives the three callers that build search params one shape to
 * agree on.
 */

export const DEFAULT_SORT = "downloads:desc";

/** Only servers collect votes, so other project types never offer this sort. */
export const VOTES_SORT = "votes:desc";

export const SORT_OPTIONS = [
  { label: "Most voted", value: VOTES_SORT },
  { label: "Most downloaded", value: DEFAULT_SORT },
  { label: "Recently updated", value: "updatedAt:desc" },
  { label: "Name (A–Z)", value: "name:asc" },
] as const;

const NON_SERVER_SORT_OPTIONS = SORT_OPTIONS.filter(
  (option) => option.value !== VOTES_SORT
);

export const sortOptionsFor = (type: ProjectType) =>
  type === "server" ? SORT_OPTIONS : NON_SERVER_SORT_OPTIONS;

/** Matches the input debounce, so a request is only made once typing settles. */
export const SEARCH_DEBOUNCE_MS = 300;

export interface ProjectBrowserFilters {
  category: string;
  clientRequirement: string;
  gameVersion: string;
  loader: string;
  page: number;
  query: string;
  sort: string;
  type: ProjectType;
}

/** One place that decides what a search request looks like. */
export const buildSearchParams = ({
  category,
  clientRequirement,
  gameVersion,
  loader,
  page,
  query,
  sort,
  type,
}: ProjectBrowserFilters): ProjectSearchParams => ({
  category,
  clientRequirement,
  gameVersion,
  loader,
  page,
  query,
  sort,
  type,
});

export interface ProjectBrowserFilterValues {
  category: string;
  clientRequirement: string;
  gameVersion: string;
  loader: string;
  query: string;
}

/**
 * How many filters the reader has set, ignoring sort and page.
 *
 * Sort always has a value and a page number is navigation rather than a
 * filter, so counting either would leave "Clear filters" visible on an
 * untouched page.
 */
export const activeFilterCount = ({
  category,
  clientRequirement,
  gameVersion,
  loader,
  query,
}: ProjectBrowserFilterValues): number =>
  [category, clientRequirement, gameVersion, loader, query].filter(
    (value) => value.length > 0
  ).length;

export const hasActiveFilters = (
  filters: ProjectBrowserFilterValues
): boolean => activeFilterCount(filters) > 0;

export const totalPagesFor = (result: ProjectSearchResponse | null): number =>
  result
    ? Math.max(1, Math.ceil(result.estimatedTotalHits / result.pageSize))
    : 1;

const formatList = (items: readonly string[]): string => {
  if (items.length === 0) {
    return "";
  }

  if (items.length === 1) {
    return items[0] ?? "";
  }

  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
};

/** The panel's helper line, phrased for the fields this type actually has. */
export const searchHintFor = (type: ProjectType): string => {
  const facets = ["name", "category", "game version"];

  if (hasLoaders(type)) {
    facets.push(LOADER_LABELS[type].singular.toLowerCase());
  }

  if (type === "server") {
    facets.push("client requirement");
  }

  return `Search ${PROJECT_TYPE_LABELS[type].plural.toLowerCase()} by ${formatList(facets)}.`;
};

export const LIVE_EVENT_TYPES = [
  "mod.created",
  "mod.updated",
  "mod.deleted",
] as const;

export type LiveModEventType = (typeof LIVE_EVENT_TYPES)[number];

const liveEventSchema = object({
  data: object({ id: string(), name: string() }),
  event: picklist(LIVE_EVENT_TYPES),
});

export type LiveModEvent = InferOutput<typeof liveEventSchema>;

export const LIVE_EVENT_LABELS = {
  "mod.created": "New project added",
  "mod.deleted": "Project removed",
  "mod.updated": "Project updated",
} as const satisfies Record<LiveModEventType, string>;

/**
 * Validates a stream frame before it reaches React state.
 *
 * The event stream is external input even though this app produces it, so the
 * frame is parsed instead of cast. Returning `null` lets the caller ignore a
 * malformed frame without showing a misleading banner.
 */
export const parseLiveEvent = (raw: string): LiveModEvent | null => {
  let payload: unknown;

  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  const result = safeParse(liveEventSchema, payload);

  return result.success ? result.output : null;
};
