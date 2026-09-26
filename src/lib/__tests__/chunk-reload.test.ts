import { describe, expect, it, vi } from "vitest";

import {
  CHUNK_RELOAD_COOLDOWN_MS,
  isChunkLoadError,
  reloadForChunkError,
} from "@/lib/chunk-reload";

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

describe(isChunkLoadError, () => {
  it.each([
    "Failed to fetch dynamically imported module: https://x/assets/a.js",
    "error loading dynamically imported module: https://x/assets/a.js",
    "Importing a module script failed.",
    "Unable to preload CSS for /assets/a.css",
  ])("recognises %s", (message) => {
    expect(isChunkLoadError(new Error(message))).toBeTruthy();
  });

  it("ignores other errors", () => {
    expect(isChunkLoadError(new Error("Project not found."))).toBeFalsy();
  });
});

describe(reloadForChunkError, () => {
  it("navigates to the page that failed", () => {
    const navigate = vi.fn<(href: string) => void>();
    const environment = { navigate, now: () => 0, storage: createStorage() };

    expect(reloadForChunkError("https://x/new", environment)).toBeTruthy();
    expect(navigate).toHaveBeenCalledExactlyOnceWith("https://x/new");
  });

  it("holds off until the cooldown has passed", () => {
    const navigate = vi.fn<(href: string) => void>();
    let time = 1_000_000;
    const environment = { navigate, now: () => time, storage: createStorage() };

    reloadForChunkError("https://x/new", environment);
    time += CHUNK_RELOAD_COOLDOWN_MS - 1;
    expect(reloadForChunkError("https://x/new", environment)).toBeFalsy();

    time += 1;
    expect(reloadForChunkError("https://x/new", environment)).toBeTruthy();
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it("still navigates without session storage", () => {
    const navigate = vi.fn<(href: string) => void>();
    const environment = { navigate, now: () => 0, storage: null };

    expect(reloadForChunkError("https://x/", environment)).toBeTruthy();
    expect(navigate).toHaveBeenCalledOnce();
  });
});
