import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { NotificationsBody } from "@/components/navbar/user-notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserNotification } from "@/lib/user-notifications.functions";

// Hoisted with the mock that needs it, since vi.mock runs above the module body.
const { noop } = vi.hoisted(() => ({ noop: () => Promise.resolve() }));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The component talks to server functions, which reach the database at import time; string paths avoid strict factory type-checking
vi.mock("@/lib/user-notifications.functions", () => ({
  countUnreadUserNotifications: noop,
  listUserNotifications: noop,
  markAllUserNotificationsRead: noop,
  markUserNotificationRead: noop,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Links need a router instance; a plain anchor keeps the test on the menu
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

const APPROVED: UserNotification = {
  createdAt: "2026-09-27T10:00:00.000Z",
  id: "notification-1",
  isRead: false,
  message: 'An admin approved "Sodium". It is now listed on the site.',
  projectId: "11111111-1111-4111-8111-111111111111",
  title: "Project approved",
  type: "project-approved",
};

const NEEDS_WORK: UserNotification = {
  ...APPROVED,
  id: "notification-2",
  isRead: true,
  message: 'An admin sent "Sodium" back to draft.',
  title: "Project needs changes",
  type: "project-rejected",
};

/**
 * Renders the menu body inside a menu that is already open.
 *
 * Base UI renders the popup through a portal, so it only exists in the document
 * while the menu is open. Driving it open through pointer events is not
 * practical here, so the menu is controlled instead.
 */
const openMenu = ({
  items,
  unread,
}: {
  items: UserNotification[] | null;
  unread: number;
}) =>
  render(
    <DropdownMenu onOpenChange={noop} open>
      <DropdownMenuTrigger />
      <DropdownMenuContent>
        <NotificationsBody
          items={items}
          onMarkAllRead={noop}
          onOpenItem={noop}
          unread={unread}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );

describe(NotificationsBody, () => {
  it("renders the header without the missing group context error", () => {
    // A group label outside a group throws "MenuGroupContext is missing" as
    // soon as the menu opens, which is why this renders an open menu.
    openMenu({ items: null, unread: 0 });

    expect(screen.getByText("Notifications")).toBeTruthy();
  });

  it("explains the empty state before anything has loaded", () => {
    openMenu({ items: null, unread: 0 });

    expect(screen.getByText(/Nothing here yet/u)).toBeTruthy();
  });

  it("lists notifications and announces which one is unread", () => {
    openMenu({ items: [APPROVED, NEEDS_WORK], unread: 1 });

    expect(screen.getByText("Project approved")).toBeTruthy();
    expect(screen.getByText("Project needs changes")).toBeTruthy();
    // The dot is decorative, so the unread state reaches the screen reader
    // through this marker, and only the unread row carries it.
    expect(screen.getAllByText("Unread:")).toHaveLength(1);
  });

  it("offers mark all as read only while something is unread", () => {
    openMenu({ items: [APPROVED], unread: 0 });
    expect(screen.queryByText("Mark all as read")).toBeNull();

    openMenu({ items: [APPROVED], unread: 1 });
    expect(screen.getByText("Mark all as read")).toBeTruthy();
  });
});
