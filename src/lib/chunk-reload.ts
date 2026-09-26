/**
 * Recovery for failed code-split chunk loads.
 *
 * A browser remembers a failed dynamic import for the lifetime of the page:
 * after one network blip, or after a deploy replaced the chunk files, every
 * later navigation to that route fails the same way until a full reload.
 * TanStack Router reloads once per tab session and then gives up, so this
 * reloads again, limited by time instead of per session.
 */

const CHUNK_ERROR_PATTERNS = [
  // Chromium
  "Failed to fetch dynamically imported module",
  // Firefox
  "error loading dynamically imported module",
  // Safari
  "Importing a module script failed",
  // Vite's preload helper
  "Unable to preload CSS",
] as const;

const STORAGE_KEY = "voxelvein:chunk-reload";

/** Reloading more often than this means the reload is not helping. */
export const CHUNK_RELOAD_COOLDOWN_MS = 10_000;

export const isChunkLoadError = ({ message }: Pick<Error, "message">) =>
  CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));

interface ReloadEnvironment {
  now: () => number;
  navigate: (href: string) => void;
  storage: Pick<Storage, "getItem" | "setItem"> | null;
}

const browserEnvironment = (): ReloadEnvironment => ({
  navigate: (href) => window.location.assign(href),
  now: () => Date.now(),
  storage: typeof sessionStorage === "undefined" ? null : sessionStorage,
});

/**
 * Does a full page load of `href`, unless the last one happened within the
 * cooldown (then the error is real and should be shown). Returns whether it
 * navigated.
 */
export const reloadForChunkError = (
  href: string,
  environment: ReloadEnvironment = browserEnvironment()
): boolean => {
  const { navigate, now, storage } = environment;
  const last = storage?.getItem(STORAGE_KEY);
  if (last && now() - Number(last) < CHUNK_RELOAD_COOLDOWN_MS) {
    return false;
  }
  storage?.setItem(STORAGE_KEY, String(now()));
  navigate(href);
  return true;
};
