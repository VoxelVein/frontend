import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

const subscribe = (onStoreChange: () => void): (() => void) => {
  const mediaQuery = window.matchMedia(MOBILE_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);

  return () => mediaQuery.removeEventListener("change", onStoreChange);
};

const getSnapshot = (): boolean => window.matchMedia(MOBILE_QUERY).matches;

// There is no viewport during server rendering; keep the initial client render
// at false so hydration agrees, then let the store update it after mount.
const getServerSnapshot = (): boolean => false;

export const useIsMobile = (): boolean =>
  React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
