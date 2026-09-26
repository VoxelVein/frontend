import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminNotifications } from "@/components/admin/admin-notifications";
import type { AdminNotification } from "@/lib/admin-accounts.functions";

const {
  listAdminNotificationsMock,
  markAdminNotificationReadMock,
  markAllAdminNotificationsReadMock,
} = vi.hoisted(() => ({
  listAdminNotificationsMock: vi.fn<() => Promise<AdminNotification[]>>(),
  markAdminNotificationReadMock:
    vi.fn<(opts: { data: { id: string } }) => Promise<void>>(),
  markAllAdminNotificationsReadMock: vi.fn<() => Promise<void>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The component talks to server functions; string paths avoid strict factory type-checking against the server function types
vi.mock("@/lib/admin-accounts.functions", () => ({
  listAdminNotifications: listAdminNotificationsMock,
  markAdminNotificationRead: markAdminNotificationReadMock,
  markAllAdminNotificationsRead: markAllAdminNotificationsReadMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Toasts render into a portal outside the component tree; a stub keeps the test on the component
vi.mock("sonner", () => ({
  toast: { error: vi.fn<(message: string) => void>() },
}));

const notification = (
  id: string,
  title: string,
  readAt: string | null
): AdminNotification => ({
  createdAt: "2026-09-20T10:00:00.000Z",
  id,
  message: `${title} will lose its owner.`,
  projectId: null,
  readAt,
  title,
  type: "protected-project-orphaned",
  userId: null,
});

describe(AdminNotifications, () => {
  beforeEach(() => {
    listAdminNotificationsMock.mockReset();
    markAdminNotificationReadMock.mockReset().mockResolvedValue();
    markAllAdminNotificationsReadMock.mockReset().mockResolvedValue();
  });

  it("shows an empty state when there are no notifications", async () => {
    listAdminNotificationsMock.mockResolvedValue([]);
    render(<AdminNotifications />);

    await expect(screen.findByText("No notifications")).resolves.toBeTruthy();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Mark all as read",
      }).disabled
    ).toBeTruthy();
  });

  it("marks every notification read and reports the change", async () => {
    listAdminNotificationsMock.mockResolvedValue([
      notification("n1", "Big Mod", null),
      notification("n2", "Huge Plugin", null),
    ]);
    const onReadStateChange = vi.fn<() => void>();
    render(<AdminNotifications onReadStateChange={onReadStateChange} />);

    await expect(screen.findAllByText("Unread")).resolves.toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

    await waitFor(() => {
      expect(screen.queryByText("Unread")).toBeNull();
    });
    expect(markAllAdminNotificationsReadMock).toHaveBeenCalledOnce();
    expect(onReadStateChange).toHaveBeenCalledOnce();
  });

  it("marks a single notification read", async () => {
    listAdminNotificationsMock.mockResolvedValue([
      notification("n1", "Big Mod", null),
      notification("n2", "Huge Plugin", "2026-09-21T10:00:00.000Z"),
    ]);
    render(<AdminNotifications />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Mark as read.*Big Mod/u })
    );

    await waitFor(() => {
      expect(markAdminNotificationReadMock).toHaveBeenCalledWith({
        data: { id: "n1" },
      });
    });
    await waitFor(() => {
      expect(screen.queryByText("Unread")).toBeNull();
    });
  });
});
