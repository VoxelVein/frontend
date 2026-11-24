import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

const subscribe = (onStoreChange: () => void): (() => void) => {
  const mediaQuery = window.matchMedia(MOBILE_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);

<<<<<<< Updated upstream
  return () => mediaQuery.removeEventListener("change", onStoreChange);
};
=======
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    return () => mql.removeEventListener("change", onChange);
  }, []);
>>>>>>> Stashed changes

const getSnapshot = (): boolean => window.matchMedia(MOBILE_QUERY).matches;

// There is no viewport during server rendering; keep the initial client render
// at false so hydration agrees, then let the store update it after mount.
const getServerSnapshot = (): boolean => false;

export const useIsMobile = (): boolean =>
  React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
