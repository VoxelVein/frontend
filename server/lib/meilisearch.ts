import { Meilisearch } from "meilisearch";

import "../env";

export const PROJECTS_INDEX = "projects";

const host = process.env.MEILI_HOST ?? "http://localhost:7700";

/** How long a health probe result is trusted before re-checking. */
const HEALTH_TTL_MS = 30_000;
/** Upper bound on a probe, so a dead instance cannot stall a request. */
const HEALTH_TIMEOUT_MS = 2000;

/**
 * The search routes are public, so they must only ever hold a search-scoped
 * key. Never fall back to the master key.
 *
 * Resolved lazily: a missing key must degrade search to "unavailable" rather
 * than throw while this module is being imported, which would take down every
 * other route on the API server.
 */
const loadSearchKey = (): string | null => {
  const key = process.env.MEILI_SEARCH_KEY?.trim();
  return key || null;
};

/** True when a search-scoped key is configured. Says nothing about uptime. */
export const isSearchConfigured = (): boolean => loadSearchKey() !== null;

/** The search client, or `null` when no search-scoped key is configured. */
export const getSearchClient = (): Meilisearch | null => {
  const apiKey = loadSearchKey();

  if (apiKey === null) {
    return null;
  }

  return new Meilisearch({
    apiKey,
    host,
  });
};

let healthCache: { available: boolean; expiresAt: number } | null = null;

/**
 * Probes `/health`, which Meilisearch serves without authentication.
 *
 * `meilisearch.health()` accepts no request options, so it cannot be given a
 * deadline; a raw fetch is used instead. Results are cached so a search request
 * never pays for an extra round trip.
 */
export const isSearchAvailable = async (): Promise<boolean> => {
  if (healthCache !== null && healthCache.expiresAt > Date.now()) {
    return healthCache.available;
  }

  let available = false;

  try {
    const response = await fetch(`${host}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    available = response.ok;
  } catch {
    available = false;
  }

  healthCache = { available, expiresAt: Date.now() + HEALTH_TTL_MS };

  return available;
};
