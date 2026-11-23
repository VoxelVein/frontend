import { useSyncExternalStore } from "react";

const MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

let mediaQueryList: MediaQueryList | undefined;

const getMediaQueryList = () => {
  mediaQueryList ??= window.matchMedia(MEDIA_QUERY);

  return mediaQueryList;
};

// oxlint-disable-next-line promise/prefer-await-to-callbacks -- addEventListener/removeEventListener are callback-based DOM APIs, not promises; useSyncExternalStore requires this subscribe signature
const subscribe = (callback: () => void) => {
  const media = getMediaQueryList();
  media.addEventListener("change", callback);

  return () => media.removeEventListener("change", callback);
};

const getSnapshot = () => getMediaQueryList().matches;

const getServerSnapshot = () => false;

/** SSR-safe hook that tracks the `prefers-reduced-motion` media query. */
const usePrefersReducedMotion = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export { usePrefersReducedMotion };
