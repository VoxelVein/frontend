import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SettingsAppearance } from "@/components/settings/settings-appearance";
import { CUSTOM_CURSOR_STORAGE_KEY } from "@/lib/custom-cursor";

const cursorSwitch = () =>
  screen.getByRole("switch", { name: "Custom cursor" });

describe(SettingsAppearance, () => {
  afterEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.customCursor;
  });

  it("describes the setting and starts enabled", () => {
    render(<SettingsAppearance />);

    expect(cursorSwitch()).toHaveAttribute("aria-checked", "true");
    expect(cursorSwitch()).toHaveAccessibleDescription(
      /Links, text fields and resize handles keep their usual cursor/u
    );
  });

  it("persists a disabled preference across a remount", () => {
    const first = render(<SettingsAppearance />);
    fireEvent.click(cursorSwitch());

    expect(cursorSwitch()).toHaveAttribute("aria-checked", "false");
    expect(window.localStorage.getItem(CUSTOM_CURSOR_STORAGE_KEY)).toBe("off");
    expect(document.documentElement.dataset.customCursor).toBe("off");

    first.unmount();
    render(<SettingsAppearance />);

    expect(cursorSwitch()).toHaveAttribute("aria-checked", "false");
  });

  it("restores the default when switched back on", () => {
    window.localStorage.setItem(CUSTOM_CURSOR_STORAGE_KEY, "off");
    document.documentElement.dataset.customCursor = "off";
    render(<SettingsAppearance />);

    fireEvent.click(cursorSwitch());

    expect(window.localStorage.getItem(CUSTOM_CURSOR_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.customCursor).toBeUndefined();
  });

  it("follows a change made in another tab", async () => {
    render(<SettingsAppearance />);

    window.localStorage.setItem(CUSTOM_CURSOR_STORAGE_KEY, "off");
    window.dispatchEvent(
      new StorageEvent("storage", { key: CUSTOM_CURSOR_STORAGE_KEY })
    );

    await waitFor(() => {
      expect(cursorSwitch()).toHaveAttribute("aria-checked", "false");
    });
  });
});
