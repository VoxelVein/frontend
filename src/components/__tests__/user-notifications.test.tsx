import { fireEvent, render, screen, within } from "@testing-library/react";
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
  dismissReadUserNotifications: noop,
  dismissUserNotification: noop,
  listUserNotifications: noop,
  markAllUserNotificationsRead: noop,
  markUserNotificationRead: noop,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Links need a router instance; a plain anchor keeps the test on the menu
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <a
      href="/"
      onClick={() => {
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
}));

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

const APPROVED: UserNotification = {
  createdAt: "2026-09-27T10:00:00.000Z",
  id: "notification-1",
  isRead: false,
  message: 'An admin approved "Sodium". Anyone can now find it on the site.',
  projectId: PROJECT_ID,
  projectName: "Sodium",
  projectSlug: "sodium",
  title: "Project approved",
  type: "project-approved",
};

const NEEDS_WORK: UserNotification = {
  ...APPROVED,
  id: "notification-2",
  isRead: true,
  message: 'An admin asked for changes to "Sodium".',
  title: "Project needs changes",
  type: "project-rejected",
};

/** A report outcome: no project, so nothing to open. */
const REPORT_ACTIONED: UserNotification = {
  ...APPROVED,
  id: "notification-3",
  message: "A moderator looked at what you reported and dealt with it.",
  projectId: null,
  projectName: null,
  projectSlug: null,
  title: "Report actioned",
  type: "report-resolved",
};

interface MenuOptions {
  isError?: boolean;
  isLoading?: boolean;
  items: UserNotification[] | null;
  onDismiss?: (id: string) => void;
  onDismissRead?: () => void;
  onOpen?: (id: string) => void;
  unread: number;
}

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-09-27T12:00:00.000Z");

/**
 * Renders the menu body inside a menu that is already open.
 *
 * Base UI renders the popup through a portal, so it only exists in the document
 * while the menu is open. Driving it open through pointer events is not
 * practical here, so the menu is controlled instead.
 */
const openMenu = ({
  isError = false,
  isLoading = false,
  items,
  onDismiss = noop,
  onDismissRead = noop,
  onOpen = noop,
  unread,
}: MenuOptions) =>
  render(
    <DropdownMenu onOpenChange={noop} open>
      <DropdownMenuTrigger />
      <DropdownMenuContent>
        <NotificationsBody
          isError={isError}
          isLoading={isLoading}
          isMutating={false}
          items={items}
          now={NOW}
          onDismiss={onDismiss}
          onDismissRead={onDismissRead}
          onMarkAllRead={noop}
          onMarkRead={noop}
          onOpen={onOpen}
          unread={unread}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );

describe(NotificationsBody, () => {
  it("renders the header without the missing group context error", () => {
    openMenu({ items: null, unread: 0 });

    expect(screen.getByText("Notifications")).toBeTruthy();
  });

  it("does not claim an empty inbox while the first load is in flight", () => {
    openMenu({ isLoading: true, items: null, unread: 3 });

    // The old behaviour rendered "Nothing here yet" for the length of the
    // request, telling someone with three unread notifications that they had
    // none. A busy indicator is the only honest thing to show before the data
    // exists.
    expect(screen.queryByText("Nothing here yet")).toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it("says so when the inbox really is empty", () => {
    openMenu({ items: [], unread: 0 });

    expect(screen.getByText("Nothing here yet")).toBeTruthy();
  });

  it("explains an empty inbox in the reader's terms", () => {
    openMenu({ items: [], unread: 0 });

    expect(
      screen.getByText(/when a moderator reviews one of your projects/iu)
    ).toBeTruthy();
    expect(
      screen.getByText(/when they look at something you reported/iu)
    ).toBeTruthy();
  });

  it("reports a load failure rather than showing an empty inbox", () => {
    // An empty inbox and a failed request look identical otherwise, and
    // "nothing here yet" reads as an absence of news rather than an error.
    openMenu({ isError: true, items: null, unread: 0 });

    expect(
      screen.getByText(/could not load your notifications/iu)
    ).toBeTruthy();
    expect(screen.queryByText("Nothing here yet")).toBeNull();
  });

  it("lists notifications and announces which one is unread", () => {
    openMenu({ items: [APPROVED, NEEDS_WORK], unread: 1 });

    expect(screen.getByText("Project approved")).toBeTruthy();
    expect(screen.getByText("Project needs changes")).toBeTruthy();
    // The dot is decorative, so the unread state reaches the screen reader
    // through this marker, and only the unread row carries it.
    expect(screen.getAllByText("Unread:")).toHaveLength(1);
  });

  it("shows how many are unread in the header", () => {
    openMenu({ items: [APPROVED], unread: 3 });

    expect(screen.getByText("3 unread")).toBeTruthy();
  });

  it("names the project on the row, so it is identifiable without opening it", () => {
    openMenu({ items: [APPROVED], unread: 1 });

    expect(screen.getByText("Sodium")).toBeTruthy();
  });

  it("shows a relative time rather than a date to do arithmetic on", () => {
    const recent = {
      ...APPROVED,
      createdAt: new Date(NOW - 5 * 60 * 1000).toISOString(),
    };
    openMenu({ items: [recent], unread: 1 });

    // The question a reader has is "is this new?", which a date only answers by
    // making them compare it to today themselves.
    expect(screen.getByText(/minutes? ago/iu)).toBeTruthy();
    // The absolute date stays available rather than being thrown away.
    expect(
      screen.getByText(/minutes? ago/iu).getAttribute("title")
    ).toBeTruthy();
  });

  it("groups by day, with today under its own heading", () => {
    openMenu({
      items: [
        { ...APPROVED, createdAt: new Date(NOW - 2 * HOUR).toISOString() },
        {
          ...NEEDS_WORK,
          id: "notification-4",
          createdAt: new Date(NOW - 3 * 24 * HOUR).toISOString(),
        },
      ],
      unread: 1,
    });

    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Earlier")).toBeTruthy();
  });

  it("calls last night yesterday, not the day before", () => {
    // Measured against whole local days rather than 24 hours ago, so a 9am read
    // of an 11pm notification does not land in "Earlier".
    const lastNight = new Date(NOW - 20 * HOUR).toISOString();
    openMenu({ items: [{ ...APPROVED, createdAt: lastNight }], unread: 1 });

    expect(screen.getByText("Yesterday")).toBeTruthy();
  });

  it("offers mark all as read only while something is unread", () => {
    openMenu({ items: [APPROVED], unread: 0 });
    expect(screen.queryByText("Mark all as read")).toBeNull();

    openMenu({ items: [APPROVED], unread: 1 });
    expect(screen.getByText("Mark all as read")).toBeTruthy();
  });

  it("offers a mark-as-read button only on unread notifications", () => {
    openMenu({ items: [APPROVED, NEEDS_WORK], unread: 1 });

    expect(
      screen.getAllByRole("button", { name: /^mark .* as read$/iu })
    ).toHaveLength(1);
  });

  it("names the notification its mark-as-read button acts on", () => {
    openMenu({ items: [APPROVED], unread: 1 });

    // The visible control is only an icon, so the accessible name has to
    // identify which notification it belongs to.
    expect(
      screen.getByRole("button", { name: 'Mark "Project approved" as read' })
    ).toBeTruthy();
  });

  it("offers a way to dismiss a notification, not just to mark it read", () => {
    const onDismiss = vi.fn<(id: string) => void>();
    openMenu({ items: [APPROVED, NEEDS_WORK], unread: 1, onDismiss });

    // Read rows accumulate forever otherwise, so the list fills to its cap and
    // stops showing anything new while looking identical every visit.
    fireEvent.click(
      screen.getByRole("button", { name: 'Dismiss "Project approved"' })
    );

    expect(onDismiss).toHaveBeenCalledWith("notification-1");
  });

  it("offers a dismiss on read rows too", () => {
    openMenu({ items: [NEEDS_WORK], unread: 0 });

    expect(
      screen.getByRole("button", { name: 'Dismiss "Project needs changes"' })
    ).toBeTruthy();
  });

  it("offers to clear read notifications once nothing is unread", () => {
    const onDismissRead = vi.fn<() => void>();
    openMenu({ items: [NEEDS_WORK], unread: 0, onDismissRead });

    fireEvent.click(screen.getByText("Clear read notifications"));

    expect(onDismissRead).toHaveBeenCalledWith();
  });

  it("does not offer to clear read notifications while some are still unread", () => {
    openMenu({ items: [APPROVED], unread: 1 });

    // Clearing now would throw away an unread row before the reader saw it.
    expect(screen.queryByText("Clear read notifications")).toBeNull();
  });

  it("opens a project notification when its row is followed", () => {
    const onOpen = vi.fn<(id: string) => void>();
    openMenu({ items: [APPROVED], unread: 1, onOpen });

    fireEvent.click(screen.getByRole("link", { name: /Project approved/iu }));

    expect(onOpen).toHaveBeenCalledWith("notification-1");
  });

  it("gives a report outcome no link, because there is nowhere to go", () => {
    openMenu({ items: [REPORT_ACTIONED], unread: 1 });

    // A control that leads nowhere is worse than no control, and the message is
    // the whole notification.
    expect(screen.getByText("Report actioned")).toBeTruthy();
    expect(
      screen.queryByRole("link", { name: /Report actioned/iu })
    ).toBeNull();
  });

  it("distinguishes the four kinds by icon rather than by prose alone", () => {
    openMenu({
      items: [
        APPROVED,
        NEEDS_WORK,
        REPORT_ACTIONED,
        {
          ...REPORT_ACTIONED,
          id: "n4",
          title: "Report dismissed",
          type: "report-dismissed",
        },
      ],
      unread: 2,
    });

    // Four rows about three subjects, scannable by shape before anyone reads.
    const tiles = document.querySelectorAll('[data-slot="notification-icon"]');
    const tints = new Set([...tiles].map((tile) => tile.className));

    expect(tiles).toHaveLength(4);
    expect(tints.size).toBeGreaterThan(1);
  });

  it("keeps the project name out of a report row, which has no project", () => {
    openMenu({ items: [REPORT_ACTIONED], unread: 1 });

    expect(screen.queryByText("Sodium")).toBeNull();
  });

  it("scrolls a long list rather than growing without bound", () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      ...APPROVED,
      id: `notification-${index}`,
    }));
    openMenu({ items: many, unread: 1 });

    // A long list has to scroll rather than growing the panel without bound.
    const scroller = document.querySelector<HTMLElement>(".overflow-y-auto");

    expect(scroller).not.toBeNull();
    expect(within(scroller ?? document.body).getAllByRole("link")).toHaveLength(
      30
    );
  });
});
