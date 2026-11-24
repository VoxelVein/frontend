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

  it("defaults to disabled when nothing was stored", () => {
    expect(readCustomCursorEnabled()).toBeFalsy();
  });

  it("is enabled only by the explicit on value", () => {
    window.localStorage.setItem(CUSTOM_CURSOR_STORAGE_KEY, "on");

    expect(readCustomCursorEnabled()).toBeTruthy();

    window.localStorage.setItem(CUSTOM_CURSOR_STORAGE_KEY, "off");

    expect(readCustomCursorEnabled()).toBeFalsy();
  });

  it("stores the on value and clears the key when disabled", () => {
    setCustomCursorEnabled(true);

    expect(window.localStorage.getItem(CUSTOM_CURSOR_STORAGE_KEY)).toBe("on");
    expect(customCursor()).toBeUndefined();

    setCustomCursorEnabled(false);

    expect(window.localStorage.getItem(CUSTOM_CURSOR_STORAGE_KEY)).toBeNull();
    expect(customCursor()).toBe("off");
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

    window.localStorage.setItem(CUSTOM_CURSOR_STORAGE_KEY, "on");
    window.dispatchEvent(
      new StorageEvent("storage", { key: CUSTOM_CURSOR_STORAGE_KEY })
    );

    expect(customCursor()).toBeUndefined();
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

  it("applies the stored value before hydration", () => {
    applyStoredCursorPreference();
    expect(customCursor()).toBe("off");

    window.localStorage.setItem(CUSTOM_CURSOR_STORAGE_KEY, "on");
    applyStoredCursorPreference();
    expect(customCursor()).toBeUndefined();

    window.localStorage.setItem(CUSTOM_CURSOR_STORAGE_KEY, "off");
    applyStoredCursorPreference();
    expect(customCursor()).toBe("off");
  });
});
