/**
 * The site-wide cursor preference.
 *
 * The cursor is a local UI preference, like the theme: it is stored in
 * localStorage and applied to the document root before hydration so a visitor
 * who turned it on never sees the native arrow flash on first paint. The
 * feature is opt-in and still marked beta, so only the "on" value enables it;
 * an absent key means the cursor is disabled.
 */

export const CUSTOM_CURSOR_STORAGE_KEY = "voxelvein-custom-cursor";
const CURSOR_ENABLED = "on";
const CURSOR_DISABLED = "off";

export const readCustomCursorEnabled = (): boolean => {
  try {
    return (
      window.localStorage.getItem(CUSTOM_CURSOR_STORAGE_KEY) === CURSOR_ENABLED
    );
  } catch {
    // Storage can be blocked (private mode, strict cookie settings). The
    // cursor stays off, which is the default for every visitor.
    return false;
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
      window.localStorage.setItem(CUSTOM_CURSOR_STORAGE_KEY, CURSOR_ENABLED);
    } else {
      // Absence is the default, so clearing the key is enough; an older "off"
      // value is removed too rather than left behind as a stale preference.
      window.localStorage.removeItem(CUSTOM_CURSOR_STORAGE_KEY);
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
    if (window.localStorage.getItem("voxelvein-custom-cursor") === "on") {
      delete document.documentElement.dataset.customCursor;
    } else {
      document.documentElement.dataset.customCursor = "off";
    }
  } catch {
    // Storage cannot be read: keep the default, which is the native cursor.
    document.documentElement.dataset.customCursor = "off";
  }
};
