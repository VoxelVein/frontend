import type {
  ProjectSearchParams,
  ProjectSearchResponse,
} from "@/lib/project-search.functions";

export interface ProjectSearchCacheOptions {
  maxEntries?: number;
  ttlMs?: number;
}

export interface ProjectSearchCache {
  clear: () => void;
  delete: (params: ProjectSearchParams) => void;
  get: (params: ProjectSearchParams) => ProjectSearchResponse | undefined;
  set: (params: ProjectSearchParams, data: ProjectSearchResponse) => void;
}

interface ProjectSearchCacheEntry {
  data: ProjectSearchResponse;
  expiresAt: number;
}

const DEFAULT_MAX_ENTRIES = 50;
const DEFAULT_TTL_MS = 60_000;

const buildCacheKey = (params: ProjectSearchParams): string =>
  JSON.stringify([
    params.type,
    params.query,
    params.category ?? "",
    params.gameVersion ?? "",
    params.loader ?? "",
    params.sort,
    params.page ?? 1,
  ]);

export const createProjectSearchCache = (
  options: ProjectSearchCacheOptions = {}
): ProjectSearchCache => {
  const maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const entries = new Map<string, ProjectSearchCacheEntry>();

  return {
    clear: () => {
      entries.clear();
    },
    delete: (params) => {
      entries.delete(buildCacheKey(params));
    },
    get: (params) => {
      const key = buildCacheKey(params);
      const entry = entries.get(key);

      if (!entry) {
        return;
      }

      if (entry.expiresAt <= Date.now()) {
        entries.delete(key);
        return;
      }

      // Refresh the LRU position: delete + re-insert moves the key to the tail.
      entries.delete(key);
      entries.set(key, entry);

      return entry.data;
    },
    set: (params, data) => {
      const key = buildCacheKey(params);

      if (entries.has(key)) {
        entries.delete(key);
      }

      // Evict the least-recently-used entry (the Map head) when at capacity.
      if (entries.size >= maxEntries) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey !== undefined) {
          entries.delete(oldestKey);
        }
      }

      entries.set(key, { data, expiresAt: Date.now() + ttlMs });
    },
  };
};

export const projectSearchCache = createProjectSearchCache();
