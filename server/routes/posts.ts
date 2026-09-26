import { Elysia, t } from "elysia";

import type { PostSearchDocument } from "../../src/lib/posts-search";
import { POSTS_INDEX } from "../../src/lib/posts-search";
import { getSearchClient, isSearchAvailable } from "../lib/meilisearch";

/**
 * Public blog-post search.
 *
 * This route is unauthenticated, so the visibility filter is hardcoded here and
 * never taken from the query string. Drafts live in the same index (the admin
 * UI needs to search them), and this hardcoded filter is the only thing keeping
 * them out of public results.
 */
export const postsRoute = new Elysia().get(
  "/api/posts/search",
  async ({ query, status }) => {
    const client = getSearchClient();

    // Search is optional infrastructure. Reporting it unavailable lets the
    // client hide its search UI instead of showing a broken results list.
    if (client === null || !(await isSearchAvailable())) {
      return status(503, { available: false, error: "Search unavailable" });
    }

    try {
      const result = await client
        .index(POSTS_INDEX)
        .search<PostSearchDocument>(query.q ?? "", {
          filter: ["published = true"],
          limit: 50,
          sort: ["createdAtTs:desc"],
        });

      return {
        available: true,
        estimatedTotalHits: result.estimatedTotalHits,
        hits: result.hits,
        query: result.query,
      };
    } catch {
      // `/health` is served without authentication, so it can pass while the key
      // is rejected or the index does not exist. Both are the same thing to the
      // reader — search cannot answer — so report the same unavailable response
      // instead of letting the request fail with a 500.
      return status(503, { available: false, error: "Search unavailable" });
    }
  },
  {
    query: t.Object({
      q: t.Optional(t.String({ maxLength: 200 })),
    }),
  }
);
