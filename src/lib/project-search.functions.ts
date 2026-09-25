import { createServerFn } from "@tanstack/react-start";

import {
  CATEGORIES_BY_TYPE,
  GAME_VERSIONS as ALL_GAME_VERSIONS,
  isProjectType,
  LOADERS_BY_TYPE,
} from "@/lib/projects";
import type { ProjectDocument, ProjectType } from "@/lib/projects";

import env from "../../env.config";

const GAME_VERSIONS = new Set<string>(ALL_GAME_VERSIONS);

const SORTS = ["downloads:desc", "updatedAt:desc", "name:asc"] as const;

export interface ProjectSearchParams {
  category?: string;
  gameVersion?: string;
  loader?: string;
  page?: number;
  query: string;
  sort: string;
  type: ProjectType;
}

export interface ProjectSearchResponse {
  estimatedTotalHits: number;
  facetDistribution: Record<string, Record<string, number>> | undefined;
  hits: ProjectDocument[];
  page: number;
  pageSize: number;
  query: string;
}

export const searchProjects = createServerFn({ method: "GET" })
  .validator((data: ProjectSearchParams) => {
    if (!isProjectType(data.type)) {
      throw new Error("Unknown project type.");
    }
    return data;
  })
  .handler(async ({ data }): Promise<ProjectSearchResponse> => {
    const params = new URLSearchParams({ type: data.type });
    const categories = new Set<string>(CATEGORIES_BY_TYPE[data.type]);
    const loaders = new Set<string>(LOADERS_BY_TYPE[data.type]);

    if (data.query) {
      params.set("q", data.query);
    }
    if (data.category && categories.has(data.category)) {
      params.set("category", data.category);
    }
    if (data.gameVersion && GAME_VERSIONS.has(data.gameVersion)) {
      params.set("gameVersion", data.gameVersion);
    }
    if (data.loader && loaders.has(data.loader)) {
      params.set("loader", data.loader);
    }
    if (data.page && data.page > 1) {
      params.set("page", String(data.page));
    }
    // SAFETY: SORTS is a readonly tuple of strings; widening to readonly
    // string[] is safe for the membership check below.
    params.set(
      "sort",
      (SORTS as readonly string[]).includes(data.sort)
        ? data.sort
        : "downloads:desc"
    );

    let response: Response;
    try {
      response = await fetch(
        `${env.API_URL}/api/projects/search?${params.toString()}`,
        { signal: AbortSignal.timeout(8000) }
      );
    } catch (fetchError) {
      throw new Error(
        "Could not reach the search service. Start the API server with `pnpm dev:all` and try again.",
        { cause: fetchError }
      );
    }

    if (!response.ok) {
      throw new Error(`Search failed (${response.status})`);
    }

    // SAFETY: The Elysia /api/projects/search endpoint returns the same shape as
    // the previous direct Meilisearch call (hits + estimatedTotalHits + query).
    return response.json() as Promise<ProjectSearchResponse>;
  });
