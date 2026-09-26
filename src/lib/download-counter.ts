const DEFAULT_MAX_ENTRIES = 50_000;
const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

// Clients we cannot identify share one bucket per file. That undercounts
// anonymous downloads when TRUST_PROXY is off, but keeps the counters (which
// drive the default sort) from being inflated by a simple request loop.
const ANONYMOUS_CLIENT = "anonymous";

const PREFETCH_PURPOSES = ["prefetch", "prerender"];

/** True for speculative requests (link prefetch/prerender), not real downloads. */
export const isPrefetchRequest = (headers: Headers): boolean => {
  const purpose = [
    headers.get("sec-purpose"),
    headers.get("purpose"),
    headers.get("x-moz"),
  ]
    .filter((value) => value !== null)
    .join(",")
    .toLowerCase();
  return PREFETCH_PURPOSES.some((keyword) => purpose.includes(keyword));
};

export interface DownloadDeduperOptions {
  maxEntries?: number;
  windowMs?: number;
}

export interface DownloadDeduper {
  /** Records the download and returns whether it should be counted. */
  shouldCount: (clientKey: string | null, fileId: string) => boolean;
}

/** Counts each (client, file) pair at most once per window. */
export const createDownloadDeduper = (
  options: DownloadDeduperOptions = {}
): DownloadDeduper => {
  const maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  // Insertion order equals expiry order because every entry gets the same
  // window, so the Map head is always the oldest entry.
  const expiresAtByKey = new Map<string, number>();

  const evictExpired = (now: number) => {
    for (const [key, expiresAt] of expiresAtByKey) {
      if (expiresAt > now) {
        return;
      }
      expiresAtByKey.delete(key);
    }
  };

  return {
    shouldCount: (clientKey, fileId) => {
      const now = Date.now();
      evictExpired(now);

      const key = `${clientKey ?? ANONYMOUS_CLIENT}:${fileId}`;
      if (expiresAtByKey.has(key)) {
        return false;
      }

      if (expiresAtByKey.size >= maxEntries) {
        const oldestKey = expiresAtByKey.keys().next().value;
        if (oldestKey !== undefined) {
          expiresAtByKey.delete(oldestKey);
        }
      }
      expiresAtByKey.set(key, now + windowMs);
      return true;
    },
  };
};
