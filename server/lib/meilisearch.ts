import { Meilisearch } from "meilisearch";

import "../env";

export const PROJECTS_INDEX = "projects";

const host = process.env.MEILI_HOST ?? "http://localhost:7700";

// The search route is public, so it must only ever hold a search-scoped key.
// Never fall back to the master key.
const loadSearchKey = (): string => {
  const key = process.env.MEILI_SEARCH_KEY;
  if (!key) {
    throw new Error(
      "MEILI_SEARCH_KEY must be set. The API server does not use MEILI_MASTER_KEY for public search."
    );
  }
  return key;
};

const apiKey = loadSearchKey();

export const getSearchClient = () =>
  new Meilisearch({
    apiKey,
    host,
  });
