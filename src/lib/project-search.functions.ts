import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { readTrustProxy } from "@/lib/client-key";
import {
  CATEGORIES_BY_TYPE,
  GAME_VERSIONS as ALL_GAME_VERSIONS,
  isClientRequirement,
  isProjectType,
  LOADERS_BY_TYPE,
} from "@/lib/projects";
import type { ProjectDocument, ProjectType } from "@/lib/projects";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  consumeServerLimit,
  RATE_LIMIT_MESSAGE,
  rateLimitIdentity,
} from "@/lib/rate-limit-server";
import { searchProjectsInDatabase } from "@/lib/search/projects";

const TRUST_PROXY = readTrustProxy(
  process.env.TRUST_PROXY,
  process.env.NODE_ENV === "production"
);

const GAME_VERSIONS = new Set<string>(ALL_GAME_VERSIONS);

const DEFAULT_SORT = "downloads:desc";
const SORTS = ["downloads:desc", "updatedAt:desc", "name:asc"] as const;

export interface ProjectSearchParams {
  category?: string;
  /** Servers only. */
  clientRequirement?: string;
  gameVersion?: string;
  loader?: string;
  page?: number;
  query: string;
  sort: string;
  type: ProjectType;
}

export interface ProjectSearchResponse {
  estimatedTotalHits: number;
  /**
   * Facet name to value to count. `null` when the result set could not be read.
   *
   * Explicitly `null` rather than `undefined`: this object crosses the server
   * function boundary as JSON, and a dropped `undefined` property would reach
   * the client as a missing key instead.
   */
  facetDistribution: Record<string, Record<string, number>> | null;
  hits: ProjectDocument[];
  page: number;
  pageSize: number;
  query: string;
}

/**
 * Searches published projects in Postgres.
 *
 * The database is already a hard dependency of the app, so querying it
 * directly removes a network hop and a whole class of "search is unavailable"
 * failure.
 *
 * Filter values are checked against the same allowlists the UI offers, and an
 * unknown one is dropped rather than forwarded, which is all the old endpoint
 * ever did, since it could only be reached with values the browser had already
 * validated.
 */
export const searchProjects = createServerFn({ method: "GET" })
  .validator((data: ProjectSearchParams) => {
    if (!isProjectType(data.type)) {
      throw new Error("Unknown project type.");
    }
    return data;
  })
  .handler(async ({ data }): Promise<ProjectSearchResponse> => {
    // Anonymous and uncached: every keystroke that survives the 300ms debounce
    // lands here and costs a ranked query, so this is the endpoint most worth
    // capping.
    const quota = await consumeServerLimit(
      "project-search",
      rateLimitIdentity(getRequestHeaders(), TRUST_PROXY),
      RATE_LIMITS.read
    );
    if (quota) {
      throw new Error(RATE_LIMIT_MESSAGE);
    }

    const categories = new Set<string>(CATEGORIES_BY_TYPE[data.type]);
    const loaders = new Set<string>(LOADERS_BY_TYPE[data.type]);
    // SAFETY: SORTS is a readonly tuple of strings; widening to readonly
    // string[] is safe for the membership check below.
    const sort = (SORTS as readonly string[]).includes(data.sort)
      ? data.sort
      : DEFAULT_SORT;

    return searchProjectsInDatabase({
      category:
        data.category && categories.has(data.category)
          ? data.category
          : undefined,
      // Only servers have a client requirement.
      clientRequirement:
        data.type === "server" &&
        data.clientRequirement &&
        isClientRequirement(data.clientRequirement)
          ? data.clientRequirement
          : undefined,
      gameVersion:
        data.gameVersion && GAME_VERSIONS.has(data.gameVersion)
          ? data.gameVersion
          : undefined,
      loader: data.loader && loaders.has(data.loader) ? data.loader : undefined,
      page: data.page,
      query: data.query,
      sort,
      type: data.type,
    });
  });
