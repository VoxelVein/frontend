import { createServerFn } from "@tanstack/react-start";
import { array, object, parse, string } from "valibot";

import { RELEASE_GAME_VERSIONS } from "@/lib/minecraft-versions";

const MANIFEST_URL =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

/** Releases change slowly; an hour of staleness is fine for a suggestion list. */
const CACHE_TIME_MS = 60 * 60 * 1000;

const manifestSchema = object({
  versions: array(object({ id: string(), type: string() })),
});

interface VersionCache {
  expiresAt: number;
  versions: string[];
}

let cache: VersionCache | null = null;
let inFlight: Promise<string[]> | null = null;

/** Fetches release ids from Mojang, newest first, as the manifest lists them. */
const fetchReleaseVersions = async (): Promise<string[]> => {
  const response = await fetch(MANIFEST_URL, {
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Mojang returned ${response.status}`);
  }

  const data: unknown = await response.json();
  const manifest = parse(manifestSchema, data);

  return manifest.versions.flatMap((version) =>
    version.type === "release" ? [version.id] : []
  );
};

/**
 * Suggestions come from Mojang at runtime, with the generated manifest as a
 * fallback when the network or the upstream shape is unavailable. The generator
 * that writes that manifest uses the same endpoint, so the fallback is never a
 * different idea of what a release is.
 */
const loadSuggestedVersions = async (): Promise<string[]> => {
  const now = Date.now();

  if (cache && cache.expiresAt > now) {
    return cache.versions;
  }

  if (!inFlight) {
    inFlight = fetchReleaseVersions()
      .catch(() => [...RELEASE_GAME_VERSIONS])
      .then((versions) => {
        cache = { expiresAt: Date.now() + CACHE_TIME_MS, versions };

        return versions;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  return await inFlight;
};

export const getSuggestedMinecraftVersions = createServerFn({
  method: "GET",
}).handler(loadSuggestedVersions);
