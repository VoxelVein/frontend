import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyStoredCursorPreference,
  CUSTOM_CURSOR_STORAGE_KEY,
  readCustomCursorEnabled,
  setCustomCursorEnabled,
  subscribeToCustomCursor,
} from "@/lib/custom-cursor";

const customCursor = () => document.documentElement.dataset.customCursor;

describe("custom cursor preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.customCursor;
  });

  it("defaults to enabled when nothing was stored", () => {
    expect(readCustomCursorEnabled()).toBeTruthy();
  });

  it("is disabled only by the explicit off value", () => {
    window.localStorage.setItem(CUSTOM_CURSOR_STORAGE_KEY, "off");

    expect(readCustomCursorEnabled()).toBeFalsy();

    window.localStorage.setItem(CUSTOM_CURSOR_STORAGE_KEY, "anything-else");

    expect(readCustomCursorEnabled()).toBeTruthy();
  });

  it("stores only the off value and marks the document root", () => {
    setCustomCursorEnabled(false);

    expect(window.localStorage.getItem(CUSTOM_CURSOR_STORAGE_KEY)).toBe("off");
    expect(customCursor()).toBe("off");

    setCustomCursorEnabled(true);

    expect(window.localStorage.getItem(CUSTOM_CURSOR_STORAGE_KEY)).toBeNull();
    expect(customCursor()).toBeUndefined();
  });

  it("notifies subscribers when the preference changes on this page", () => {
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeToCustomCursor(listener);

    setCustomCursorEnabled(false);
    setCustomCursorEnabled(true);

    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("follows changes made in another tab", () => {
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeToCustomCursor(listener);

    window.localStorage.setItem(CUSTOM_CURSOR_STORAGE_KEY, "off");
    window.dispatchEvent(
      new StorageEvent("storage", { key: CUSTOM_CURSOR_STORAGE_KEY })
    );

    expect(customCursor()).toBe("off");
    expect(listener).toHaveBeenCalledOnce();

    unsubscribe();
  });

  it("ignores unrelated storage changes", () => {
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribeToCustomCursor(listener);

    window.dispatchEvent(
      new StorageEvent("storage", { key: "voxelvein-theme" })
    );

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("applies the stored value before hydration without changing the default", () => {
    applyStoredCursorPreference();
    expect(customCursor()).toBeUndefined();

    window.localStorage.setItem(CUSTOM_CURSOR_STORAGE_KEY, "off");
    applyStoredCursorPreference();
    expect(customCursor()).toBe("off");
  });
});
