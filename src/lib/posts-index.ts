import { Meilisearch } from "meilisearch";

import { resolvePreview } from "@/lib/posts";
import { POSTS_INDEX, POSTS_INDEX_SETTINGS } from "@/lib/posts-search";
import type { PostSearchDocument } from "@/lib/posts-search";

import env from "../../env.config";

/**
 * Keeps the Meilisearch `posts` index in step with the `posts` table.
 *
 * The web app owns both sides, so it writes to Meilisearch directly rather than
 * asking the API server to — the API server deliberately only ever holds a
 * search-scoped key and must stay unable to write. Like `search-sync.ts`, writes
 * use a key scoped to document changes, never the master key.
 *
 * Writes are debounced and coalesced per post id so that editing one post five
 * times in a row produces a single indexing task, and so that bulk operations
 * do not stampede the index.
 */

/** How long to wait for further writes before flushing a batch. */
const REINDEX_DEBOUNCE_MS = 500;

export interface IndexablePost {
  content: string;
  createdAt: Date | string;
  excerpt: string | null;
  id: string;
  published: boolean;
  slug: string;
  title: string;
  updatedAt: Date | string;
}

let client: Meilisearch | null = null;
let initialized: Promise<boolean> | null = null;
/** Pending upserts, keyed by post id so repeated writes collapse into one. */
const pendingUpserts = new Map<string, IndexablePost>();
/** Ids to remove. An id in both maps is dropped from the upserts. */
const pendingDeletes = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> = Promise.resolve();

/** Meilisearch is optional: a missing key disables indexing, it never throws. */
const getWriteClient = (): Meilisearch | null => {
  const apiKey = env.MEILI_ADMIN_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  client ??= new Meilisearch({
    apiKey,
    host: env.MEILI_HOST,
  });

  return client;
};

export const toSearchDocument = (post: IndexablePost): PostSearchDocument => {
  const createdAt = new Date(post.createdAt);

  return {
    content: post.content,
    createdAt: createdAt.toISOString(),
    createdAtTs: createdAt.getTime(),
    excerpt: post.excerpt,
    id: post.id,
    preview: resolvePreview(post),
    published: post.published,
    slug: post.slug,
    title: post.title,
    updatedAt: new Date(post.updatedAt).toISOString(),
  };
};

/** Creates the index and applies settings once per process. */
const ensureIndex = async (): Promise<Meilisearch | null> => {
  const meili = getWriteClient();

  if (meili === null) {
    return null;
  }

  initialized ??= (async () => {
    try {
      await meili.createIndex(POSTS_INDEX, { primaryKey: "id" });
    } catch {
      // Already exists, which is the normal case after the first run.
    }

    try {
      await meili.index(POSTS_INDEX).updateSettings(POSTS_INDEX_SETTINGS);
    } catch {
      return false;
    }

    return true;
  })();

  return (await initialized) ? meili : null;
};

const applyBatch = async (upserts: IndexablePost[], deletes: string[]) => {
  const meili = await ensureIndex();

  if (meili === null) {
    return;
  }

  const index = meili.index(POSTS_INDEX);

  try {
    if (deletes.length > 0) {
      await index.deleteDocuments(deletes);
    }

    if (upserts.length > 0) {
      await index.addDocuments(upserts.map(toSearchDocument));
    }
  } catch {
    // A failed sync leaves the index stale but must never surface as a failed
    // post write; the next write, or the reindex script, repairs it.
  }
};

const flush = (): void => {
  flushTimer = null;

  if (pendingUpserts.size === 0 && pendingDeletes.size === 0) {
    return;
  }

  const upserts = [...pendingUpserts.values()];
  const deletes = [...pendingDeletes];
  pendingUpserts.clear();
  pendingDeletes.clear();

  const previous = inFlight;

  // Serialize batches so two flushes cannot interleave index tasks.
  inFlight = (async () => {
    await previous;
    await applyBatch(upserts, deletes);
  })();
};

/** Queues a post for (re)indexing. Resolves once queued, not once indexed. */
export const scheduleReindex = (post: IndexablePost): void => {
  // A delete followed by an upsert of the same id is a net upsert.
  pendingDeletes.delete(post.id);
  pendingUpserts.set(post.id, post);

  if (flushTimer !== null) {
    clearTimeout(flushTimer);
  }

  flushTimer = setTimeout(flush, REINDEX_DEBOUNCE_MS);
};

/** Queues a post for removal from the index. */
export const scheduleReindexDelete = (id: string): void => {
  pendingUpserts.delete(id);
  pendingDeletes.add(id);

  if (flushTimer !== null) {
    clearTimeout(flushTimer);
  }

  flushTimer = setTimeout(flush, REINDEX_DEBOUNCE_MS);
};

/** Awaits the current batch. Test seam, and used before the process exits. */
export const flushReindex = async (): Promise<void> => {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  flush();
  await inFlight;
};

/** Drops all queued work. Test seam. */
export const resetReindexQueue = (): void => {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  pendingUpserts.clear();
  pendingDeletes.clear();
  initialized = null;
  inFlight = Promise.resolve();
};

/** Runs `work` against the index, or returns null when search is unavailable. */
export const withIndex = async <T>(
  work: (index: ReturnType<Meilisearch["index"]>) => Promise<T>
): Promise<T | null> => {
  const meili = await ensureIndex();

  if (meili === null) {
    return null;
  }

  try {
    return await work(meili.index(POSTS_INDEX));
  } catch {
    return null;
  }
};
