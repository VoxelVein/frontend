import { IconBell, IconChecks } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import type { UserNotification } from "@/lib/user-notifications.functions";
import {
  countUnreadUserNotifications,
  listUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
} from "@/lib/user-notifications.functions";

/** Above this the badge stops being a countable number. */
const BADGE_MAX = 9;

const markRead = (items: UserNotification[], id: string): UserNotification[] =>
  items.map((item) => (item.id === id ? { ...item, isRead: true } : item));

/**
 * The inside of the notification menu.
 *
 * Split from the bell so the menu's structure can be rendered on its own in a
 * test. Base UI's group label throws unless it is inside a group, and that
 * failure only happens once the menu is actually open, so a test that never
 * opened the menu would not have caught it.
 */
export const NotificationsBody = ({
  items,
  onMarkAllRead,
  onOpenItem,
  unread,
}: {
  /** Null until the first open has loaded, which renders as the empty state. */
  items: UserNotification[] | null;
  onMarkAllRead: () => Promise<void>;
  onOpenItem: (id: string) => Promise<void>;
  unread: number;
}) => (
  <>
    {/* The label is a Base UI GroupLabel, so it needs the group that supplies
        its context. Items and separators stay outside it, as in the user menu. */}
    <DropdownMenuGroup>
      <DropdownMenuLabel className="border-border/70 border-b px-3 py-2">
        Notifications
      </DropdownMenuLabel>
    </DropdownMenuGroup>

    {items === null || items.length === 0 ? (
      <p className="text-muted-foreground px-3 py-6 text-center text-sm">
        Nothing here yet. You are told when an admin reviews one of your
        projects.
      </p>
    ) : (
      items.map((item) => (
        <DropdownMenuItem
          key={item.id}
          onClick={() => onOpenItem(item.id)}
          render={
            <Link
              to="/dashboard/projects/$projectId"
              params={{ projectId: item.projectId }}
            />
          }
          className="flex w-full cursor-pointer flex-col items-start gap-1 rounded-lg px-3 py-2.5 text-left"
        >
          <span className="flex w-full items-center gap-2">
            {item.isRead ? null : (
              <span
                aria-hidden="true"
                className="bg-primary size-2 shrink-0 rounded-full"
              />
            )}
            <span className="text-foreground text-sm font-medium">
              {item.isRead ? null : <span className="sr-only">Unread: </span>}
              {item.title}
            </span>
          </span>
          <span className="text-muted-foreground line-clamp-2 text-sm">
            {item.message}
          </span>
          <span className="text-muted-foreground text-xs">
            {formatDate(item.createdAt)}
          </span>
        </DropdownMenuItem>
      ))
    )}

    {unread > 0 ? (
      <>
        <DropdownMenuSeparator className="border-border/70 my-1 border-t" />
        <DropdownMenuItem
          onClick={onMarkAllRead}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium"
        >
          <IconChecks size={16} stroke={1.8} aria-hidden="true" />
          Mark all as read
        </DropdownMenuItem>
      </>
    ) : null}
  </>
);

/**
 * The signed-in user's notification bell.
 *
 * The badge comes from a dedicated count rather than from the loaded list,
 * because the list is capped while the count is not: a user with more unread
 * notifications than the list limit would otherwise be told they have exactly
 * as many as happen to fit.
 */
export const UserNotifications = () => {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<UserNotification[] | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const loadCount = async () => {
      try {
        const count = await countUnreadUserNotifications();
        if (isCurrent) {
          setUnread(count);
        }
      } catch {
        // The badge is a convenience. The dropdown reports its own failures,
        // so a failed count must not break the page.
      }
    };
    void loadCount();
    return () => {
      isCurrent = false;
    };
  }, []);

  // Loaded on open rather than on mount: most visits never open it, and this
  // keeps the cost off every page load.
  const loadOnOpen = async (isOpen: boolean): Promise<void> => {
    if (!isOpen) {
      return;
    }
    try {
      setItems(await listUserNotifications());
    } catch {
      setItems([]);
      toast.error("Could not load your notifications.");
    }
  };

  const markAllRead = async (): Promise<void> => {
    try {
      await markAllUserNotificationsRead();
      setItems(
        (current) => current?.map((item) => ({ ...item, isRead: true })) ?? null
      );
      setUnread(0);
    } catch {
      toast.error("Could not mark your notifications as read.");
    }
  };

  const openItem = async (id: string): Promise<void> => {
    setItems((current) => (current ? markRead(current, id) : null));
    setUnread((current) => Math.max(0, current - 1));
    try {
      await markUserNotificationRead({ data: { notificationId: id } });
    } catch {
      // The row already shows as read, and the next real load corrects it.
      // Reporting here would be noise about something the user did see.
    }
  };

  const hasUnread = unread > 0;
  const ariaLabel = hasUnread
    ? `Notifications, ${unread} unread`
    : "Notifications, none unread";
  const badgeText = unread > BADGE_MAX ? `${BADGE_MAX}+` : String(unread);

  return (
    <DropdownMenu onOpenChange={loadOnOpen}>
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            // Square, and the same 44px as the theme toggle beside it. Without
            // an explicit size the button is content-width, so a taller touch
            // target would leave the bell visibly taller than it is wide.
            className="relative size-11"
            {...props}
          />
        )}
        aria-label={ariaLabel}
      >
        <IconBell size={20} stroke={1.8} aria-hidden="true" />
        {hasUnread ? (
          <span
            aria-hidden="true"
            className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 inline-flex min-w-4.5 items-center justify-center rounded-full px-1 text-xs font-semibold"
          >
            {badgeText}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-80">
        <NotificationsBody
          items={items}
          onMarkAllRead={markAllRead}
          onOpenItem={openItem}
          unread={unread}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
