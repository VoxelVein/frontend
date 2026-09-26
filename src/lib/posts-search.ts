// Shared contract between the web app (which indexes and reads) and the API
// server (which serves public search). Kept free of process.env so both sides
// can import it.

import type { Settings } from "meilisearch";

export const POSTS_INDEX = "posts";

/**
 * A post as stored in Meilisearch.
 *
 * The timestamp is stored twice because the two halves want different things:
 * `createdAt` is an ISO string for display, while `createdAtTs` is derived
 * epoch-milliseconds, because Meilisearch can only sort on numeric attributes
 * and Postgres timestamps arrive as `Date` objects.
 */
export interface PostSearchDocument {
  content: string;
  createdAt: string;
  createdAtTs: number;
  excerpt: string | null;
  id: string;
  preview: string;
  published: boolean;
  slug: string;
  title: string;
  updatedAt: string;
}

export interface PostSearchParams {
  /** Free-text query. An empty string returns everything matching the filter. */
  query: string;
}

export interface PostSearchResponse {
  /** False when Meilisearch is unconfigured or down; clients hide search UI. */
  available: boolean;
  estimatedTotalHits: number;
  hits: PostSearchDocument[];
  query: string;
}

export const UNAVAILABLE_POST_SEARCH: PostSearchResponse = {
  available: false,
  estimatedTotalHits: 0,
  hits: [],
  query: "",
};

/**
 * Applied on first index creation and by the reindex script. `published` is
 * filterable so the public route can hardcode a visibility filter.
 */
export const POSTS_INDEX_SETTINGS: Settings = {
  filterableAttributes: ["published"],
  searchableAttributes: ["title", "excerpt", "preview", "content", "slug"],
  sortableAttributes: ["createdAtTs", "title"],
  typoTolerance: {
    enabled: true,
    minWordSizeForTypos: {
      oneTypo: 1,
      twoTypos: 3,
    },
  },
};
