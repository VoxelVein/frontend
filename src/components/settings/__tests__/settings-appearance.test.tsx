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

  it("describes the setting and starts disabled", () => {
    render(<SettingsAppearance />);

    expect(screen.getByText(/beta/iu)).toBeInTheDocument();
    expect(cursorSwitch()).toHaveAttribute("aria-checked", "false");
    expect(cursorSwitch()).toHaveAccessibleDescription(
      /Links, text fields and resize handles keep their usual cursor/u
    );
  });

  it("persists an enabled preference across a remount", () => {
    const first = render(<SettingsAppearance />);
    fireEvent.click(cursorSwitch());

    expect(cursorSwitch()).toHaveAttribute("aria-checked", "true");
    expect(window.localStorage.getItem(CUSTOM_CURSOR_STORAGE_KEY)).toBe("on");
    expect(document.documentElement.dataset.customCursor).toBeUndefined();

    first.unmount();
    render(<SettingsAppearance />);

    expect(cursorSwitch()).toHaveAttribute("aria-checked", "true");
  });

  it("clears the stored preference when switched back off", () => {
    window.localStorage.setItem(CUSTOM_CURSOR_STORAGE_KEY, "on");
    delete document.documentElement.dataset.customCursor;
    render(<SettingsAppearance />);

    fireEvent.click(cursorSwitch());

    expect(window.localStorage.getItem(CUSTOM_CURSOR_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.customCursor).toBe("off");
  });

  it("follows a change made in another tab", async () => {
    render(<SettingsAppearance />);

    window.localStorage.setItem(CUSTOM_CURSOR_STORAGE_KEY, "on");
    window.dispatchEvent(
      new StorageEvent("storage", { key: CUSTOM_CURSOR_STORAGE_KEY })
    );

    await waitFor(() => {
      expect(cursorSwitch()).toHaveAttribute("aria-checked", "true");
    });
  });
});
