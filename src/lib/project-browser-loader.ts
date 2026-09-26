import { projectSearchCache } from "@/lib/project-search-cache";
import { searchProjects } from "@/lib/project-search.functions";
import type {
  ProjectSearchParams,
  ProjectSearchResponse,
} from "@/lib/project-search.functions";
import type { ProjectType } from "@/lib/projects";

const DEFAULT_SORT = "downloads:desc";

export interface ProjectBrowserData {
  initial: ProjectSearchResponse | null;
  initialError: string | null;
}

export const toSearchErrorMessage = (cause: unknown) => {
  if (!(cause instanceof Error)) {
    return "Could not search projects.";
  }

  const message = cause.message.toLowerCase();
  if (
    message.includes("fetch failed") ||
    message.includes("econnrefused") ||
    message.includes("failed to fetch")
  ) {
    return "Could not reach the search service. Start the API server with `pnpm dev:all` and try again.";
  }

  if (message.includes("aborted due to timeout")) {
    return "The search service timed out. Please try again.";
  }

  return cause.message;
};

const defaultSearchParams = (type: ProjectType): ProjectSearchParams => ({
  query: "",
  sort: DEFAULT_SORT,
  type,
});

/** Runs the default search for a type on the server for the first paint. */
export const loadProjectBrowser = async (
  type: ProjectType
): Promise<ProjectBrowserData> => {
  const params = defaultSearchParams(type);
  const cached = projectSearchCache.get(params);
  if (cached) {
    return { initial: cached, initialError: null };
  }

  try {
    const data = await searchProjects({ data: params });
    projectSearchCache.set(params, data);
    return { initial: data, initialError: null };
  } catch (loaderError) {
    return { initial: null, initialError: toSearchErrorMessage(loaderError) };
  }
};
