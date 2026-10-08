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

  // An unreachable cluster reports its own socket error, and Valkey cannot be
  // the source: the limiter fails open and swallows its own failures.
  if (message.includes("econnrefused")) {
    return "Could not reach the database. Check that PostgreSQL is running and DATABASE_URL is correct, then try again.";
  }

  // A failed fetch is the browser's RPC to this app's own server, which is the
  // only network hop on the search path; the query itself runs in Postgres.
  if (message.includes("fetch failed") || message.includes("failed to fetch")) {
    return "Could not reach the server. Reload the page and try again.";
  }

  if (message.includes("aborted due to timeout")) {
    return "The search timed out. Please try again.";
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
