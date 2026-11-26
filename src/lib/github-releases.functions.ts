import { createServerFn } from "@tanstack/react-start";

import { parseGithubReleases, RELEASES_URL } from "@/lib/github-releases";
import type { ReleaseView } from "@/lib/github-releases";

/**
 * Releases are edited by a human and never more than a few times a day, so a
 * short cache keeps the page from spending GitHub's unauthenticated request
 * budget on every navigation. In-flight requests are shared for the same
 * reason as the Mojang version suggestions: a burst on a cold cache should not
 * fan out into one request per visitor.
 */
const CACHE_TIME_MS = 5 * 60 * 1000;

interface ReleaseCache {
  expiresAt: number;
  releases: ReleaseView[];
}

let cache: ReleaseCache | null = null;
let inFlight: Promise<ReleaseView[]> | null = null;

const fetchReleases = async (): Promise<ReleaseView[]> => {
  const baseHeaders = {
    Accept: "application/vnd.github+json",
    "User-Agent": "VoxelVein-frontend",
    "X-GitHub-Api-Version": "2022-11-28",
  } satisfies Record<string, string>;

  // Optional, never required: unauthenticated limits are plenty for a cache
  // this small, and a token only raises the ceiling when one is configured.
  const token = process.env.GITHUB_TOKEN;

  const headers: HeadersInit = token
    ? { ...baseHeaders, Authorization: `Bearer ${token}` }
    : baseHeaders;

  const response = await fetch(RELEASES_URL, {
    headers,
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub returned ${response.status} while loading releases.`
    );
  }

  const data: unknown = await response.json();

  return parseGithubReleases(data);
};

const loadReleases = async (): Promise<ReleaseView[]> => {
  const now = Date.now();

  if (cache && cache.expiresAt > now) {
    return cache.releases;
  }

  if (!inFlight) {
    inFlight = fetchReleases()
      .then((releases) => {
        cache = { expiresAt: Date.now() + CACHE_TIME_MS, releases };

        return releases;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  return await inFlight;
};

export const listGithubReleases = createServerFn({ method: "GET" }).handler(
  loadReleases
);
