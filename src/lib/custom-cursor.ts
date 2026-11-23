/**
 * The site-wide cursor preference.
 *
 * The cursor is a local UI preference, like the theme: it is stored in
 * localStorage and applied to the document root before hydration so a visitor
 * who turned it off never sees the custom arrow flash on first paint. Only the
 * "off" value is stored; an absent key means the cursor is enabled.
 */

export const CUSTOM_CURSOR_STORAGE_KEY = "voxelvein-custom-cursor";
const CURSOR_DISABLED = "off";

export const readCustomCursorEnabled = (): boolean => {
  try {
    return (
      window.localStorage.getItem(CUSTOM_CURSOR_STORAGE_KEY) !== CURSOR_DISABLED
    );
  } catch {
    // Storage can be blocked (private mode, strict cookie settings). The
    // default cursor stays on instead of failing the page.
    return true;
  }
};

export const applyCustomCursorPreference = (enabled: boolean): void => {
  const { documentElement } = document;

  if (enabled) {
    delete documentElement.dataset.customCursor;
  } else {
    documentElement.dataset.customCursor = CURSOR_DISABLED;
  }
};

const listeners = new Set<() => void>();

const notifyListeners = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

const handleStorage = (event: StorageEvent): void => {
  if (event.key === CUSTOM_CURSOR_STORAGE_KEY) {
    applyCustomCursorPreference(readCustomCursorEnabled());
    notifyListeners();
  }
};

export const subscribeToCustomCursor = (listener: () => void): (() => void) => {
  const isFirstSubscriber = listeners.size === 0;
  listeners.add(listener);

  if (isFirstSubscriber) {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      window.removeEventListener("storage", handleStorage);
    }
  };
};

export const setCustomCursorEnabled = (enabled: boolean): void => {
  try {
    if (enabled) {
      window.localStorage.removeItem(CUSTOM_CURSOR_STORAGE_KEY);
    } else {
      window.localStorage.setItem(CUSTOM_CURSOR_STORAGE_KEY, CURSOR_DISABLED);
    }
  } catch {
    // Still update this page when storage is unavailable.
  }

  applyCustomCursorPreference(enabled);
  notifyListeners();
};

/**
 * Inlined into `<head>` and stringified, so this must stay self-contained: a
 * stringified function cannot call the module-scope helpers above.
 */
export const applyStoredCursorPreference = (): void => {
  try {
    if (window.localStorage.getItem("voxelvein-custom-cursor") === "off") {
      document.documentElement.dataset.customCursor = "off";
    }
  } catch {
    // Leave the default cursor in place if storage cannot be read.
  }
};
