import { Elysia, t } from "elysia";

import {
  CATEGORIES_BY_TYPE,
  GAME_VERSIONS as ALL_GAME_VERSIONS,
  LOADERS_BY_TYPE,
  isProjectType,
} from "../../src/lib/projects";
import type { ProjectDocument, ProjectType } from "../../src/lib/projects";
import {
  getSearchClient,
  isSearchAvailable,
  PROJECTS_INDEX,
} from "../lib/meilisearch";

const DEFAULT_SORT = "downloads:desc";
const SORTS = [DEFAULT_SORT, "updatedAt:desc", "name:asc"] as const;
const PAGE_SIZE = 12;
const MAX_PAGE = 1000;

const GAME_VERSIONS = new Set<string>(ALL_GAME_VERSIONS);

// Only values from the allowlists above ever reach the filter (see
// hasUnknownFilter), so they cannot contain quotes that would alter the
// Meilisearch filter expression.
const quote = (value: string) => `"${value}"`;

const isUnknown = (value: string | undefined, allowed: Set<string>) =>
  value !== undefined && !allowed.has(value);

interface FilterParams {
  category?: string;
  gameVersion?: string;
  loader?: string;
  type: ProjectType;
}

const hasUnknownFilter = (params: FilterParams): boolean =>
  isUnknown(params.category, new Set(CATEGORIES_BY_TYPE[params.type])) ||
  isUnknown(params.gameVersion, GAME_VERSIONS) ||
  isUnknown(params.loader, new Set(LOADERS_BY_TYPE[params.type]));

const buildFilter = (params: FilterParams): string[] => {
  const filters = [`type = ${quote(params.type)}`];

  if (params.category) {
    filters.push(`category = ${quote(params.category)}`);
  }
  if (params.gameVersion) {
    filters.push(`gameVersions = ${quote(params.gameVersion)}`);
  }
  if (params.loader) {
    filters.push(`loaders = ${quote(params.loader)}`);
  }

  return filters;
};

export const projectsRoute = new Elysia().get(
  "/api/projects/search",
  async ({ query, status }) => {
    // Checked here rather than with t.UnionEnum: Elysia's exact-mirror cannot
    // compile unions without the TypeBox TypeCompiler.
    if (!isProjectType(query.type)) {
      return status(422, "Unknown project type");
    }
    if (hasUnknownFilter({ ...query, type: query.type })) {
      return status(422, "Unknown filter value");
    }

    // SAFETY: SORTS is a readonly tuple of strings; widening to readonly
    // string[] is safe for the membership check below.
    const sort = (SORTS as readonly string[]).includes(query.sort ?? "")
      ? (query.sort ?? DEFAULT_SORT)
      : DEFAULT_SORT;

    const page = Math.max(1, query.page ?? 1);
    const offset = (page - 1) * PAGE_SIZE;

    const client = getSearchClient();

    // Search is optional infrastructure. Reporting it unavailable lets the
    // client hide its search UI instead of showing a broken results list.
    if (client === null || !(await isSearchAvailable())) {
      return status(503, { available: false, error: "Search unavailable" });
    }

    try {
      const result = await client
        .index(PROJECTS_INDEX)
        .search<ProjectDocument>(query.q ?? "", {
          facets: ["category", "gameVersions", "loaders"],
          filter: buildFilter({ ...query, type: query.type }),
          limit: PAGE_SIZE,
          offset,
          sort: [sort],
        });

      return {
        estimatedTotalHits: result.estimatedTotalHits,
        facetDistribution: result.facetDistribution,
        hits: result.hits,
        page,
        pageSize: PAGE_SIZE,
        query: result.query,
      };
    } catch {
      // `/health` is served without authentication, so it can pass while the key
      // is rejected or the index does not exist. Both are the same thing to the
      // caller — search cannot answer — so report the same unavailable response
      // instead of letting the request fail with a 500.
      return status(503, { available: false, error: "Search unavailable" });
    }
  },
  {
    query: t.Object({
      q: t.Optional(t.String({ maxLength: 200 })),
      type: t.String(),
      category: t.Optional(t.String()),
      gameVersion: t.Optional(t.String()),
      loader: t.Optional(t.String()),
      sort: t.Optional(t.String()),
      page: t.Optional(t.Integer({ minimum: 1, maximum: MAX_PAGE })),
    }),
  }
);
