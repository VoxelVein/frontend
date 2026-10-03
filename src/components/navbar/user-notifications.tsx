import {
  IconBell,
  IconBellOff,
  IconChecks,
  IconCircleCheck,
  IconInfoCircle,
  IconMessageReport,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { ReactNode } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import type { NotificationTone, NotificationGroup } from "@/lib/notifications";
import {
  notificationGroup,
  notificationGroupLabel,
  presentationFor,
} from "@/lib/notifications";
import { relativeTime } from "@/lib/relative-time";
import type { UserNotification } from "@/lib/user-notifications.functions";
import {
  countUnreadUserNotifications,
  dismissReadUserNotifications,
  dismissUserNotification,
  listUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
} from "@/lib/user-notifications.functions";
import { cn } from "@/lib/utils";

/** Above this the badge stops being a countable number. */
const BADGE_MAX = 9;

/** Long enough to show two lines of a project name without truncating it. */
const PANEL_WIDTH = "w-[22rem] sm:w-96";

/**
 * What the panel holds.
 *
 * `loadedAt` is stamped when the rows arrive and never moves afterwards, so
 * every relative timestamp in the panel is measured against one moment rather
 * than against whenever each row happened to render.
 */
interface Panel {
  items: UserNotification[] | null;
  loadedAt: number;
}

const UNREAD_QUERY_KEY = ["user-notifications", "unread"] as const;
const LIST_QUERY_KEY = ["user-notifications", "list"] as const;

/**
 * Icon and tint per kind.
 *
 * The icon is the fastest thing a list can offer: four rows about three
 * different subjects are scannable by shape long before anyone reads the text,
 * and without it the panel is four paragraphs of similar grey.
 */
const TONE_ICON = {
  attention: IconMessageReport,
  neutral: IconInfoCircle,
  positive: IconCircleCheck,
} as const satisfies Record<NotificationTone, typeof IconBell>;

const TONE_CLASS = {
  attention: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
  positive: "bg-primary/10 text-primary",
} as const satisfies Record<NotificationTone, string>;

/** The row's own background, so an unread row reads as unread at a glance. */
const ROW_CLASS = {
  read: "hover:bg-muted/60",
  unread: "bg-primary/5 hover:bg-primary/10",
} as const;

interface NotificationRowProps {
  isMutating: boolean;
  item: UserNotification;
  now: number;
  onDismiss: (id: string) => void;
  onMarkRead: (id: string) => void;
  onOpen: (id: string) => void;
}

/**
 * One notification.
 *
 * A container rather than a `DropdownMenuItem`, because a row carries three
 * controls: it opens, it marks read, and it dismisses. A menu item renders as a
 * single interactive element, so buttons inside one would nest controls in a
 * link, which is invalid and unusable by keyboard.
 */
const NotificationRow = ({
  isMutating,
  item,
  now,
  onDismiss,
  onMarkRead,
  onOpen,
}: NotificationRowProps) => {
  const { headline, tone } = presentationFor(item.type);
  const Icon = TONE_ICON[tone];
  const canOpen = item.projectSlug !== null;
  const absolute = formatDate(item.createdAt);

  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          TONE_CLASS[tone]
        )}
        data-slot="notification-icon"
      >
        <Icon size={16} stroke={1.8} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="text-foreground flex items-center gap-1.5 text-sm font-medium">
          {/* The dot is decoration; the sr-only word is what actually carries the
              state to a screen reader, because a bare dot announces nothing. */}
          {item.isRead ? null : (
            <>
              <span
                aria-hidden="true"
                className="bg-primary size-1.5 shrink-0 rounded-full"
              />
              <span className="sr-only">Unread:</span>
            </>
          )}
          <span className="truncate">{item.title}</span>
        </span>

        <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-sm leading-5">
          {item.message}
        </span>

        <span className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
          {/* Relative, because the question is "is this new?"; the absolute date
              stays available on hover and to a screen reader. */}
          <time dateTime={item.createdAt} title={absolute}>
            {relativeTime(item.createdAt, now)}
          </time>
          {item.projectName ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{item.projectName}</span>
            </>
          ) : null}
        </span>
      </span>
    </>
  );

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg p-2 transition-colors",
        ROW_CLASS[item.isRead ? "read" : "unread"]
      )}
    >
      {canOpen ? (
        <Link
          className="focus-visible:ring-ring min-w-0 flex-1 rounded-md focus-visible:ring-2 focus-visible:outline-none"
          onClick={() => onOpen(item.id)}
          params={{ projectId: item.projectId ?? "" }}
          to="/dashboard/projects/$projectId"
        >
          {body}
          <span className="sr-only">
            {headline}. Open {item.projectName}, created {absolute}.
          </span>
        </Link>
      ) : (
        // No destination, so not a link: a control that goes nowhere is worse
        // than no control, and the message is the whole notification.
        <div className="min-w-0 flex-1">{body}</div>
      )}

      <div className="flex shrink-0 items-center gap-0.5">
        {item.isRead ? null : (
          <Button
            aria-label={`Mark "${item.title}" as read`}
            className="text-muted-foreground hover:text-foreground size-8"
            disabled={isMutating}
            onClick={() => onMarkRead(item.id)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <IconChecks size={16} stroke={1.8} aria-hidden="true" />
          </Button>
        )}
        <Button
          aria-label={`Dismiss "${item.title}"`}
          className="text-muted-foreground hover:text-foreground size-8"
          disabled={isMutating}
          onClick={() => onDismiss(item.id)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <IconTrash size={16} stroke={1.8} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
};

/**
 * Notifications for one day, under a heading.
 *
 * A real heading rather than a separator, so the group is navigable and the
 * "Today" / "Earlier" split is announced instead of being a purely visual line.
 */
const NotificationGroupBlock = ({
  group,
  isMutating,
  items,
  now,
  onDismiss,
  onMarkRead,
  onOpen,
}: {
  group: NotificationGroup;
  isMutating: boolean;
  items: UserNotification[];
  now: number;
  onDismiss: (id: string) => void;
  onMarkRead: (id: string) => void;
  onOpen: (id: string) => void;
}) => (
  <DropdownMenuGroup>
    <DropdownMenuLabel className="text-muted-foreground px-3 py-1.5 text-xs font-medium tracking-wide uppercase">
      {notificationGroupLabel(group)}
    </DropdownMenuLabel>
    <div className="px-1">
      {items.map((item) => (
        <NotificationRow
          isMutating={isMutating}
          item={item}
          key={item.id}
          now={now}
          onDismiss={onDismiss}
          onMarkRead={onMarkRead}
          onOpen={onOpen}
        />
      ))}
    </div>
  </DropdownMenuGroup>
);

/**
 * Rows shown while the first load is in flight.
 *
 * Deliberately *not* the empty state. The list loads on open, so rendering
 * "Nothing here yet" during that gap tells a user with twenty unread
 * notifications that they have none, for as long as the request takes — the
 * single cheapest-feeling thing this panel could do.
 */
const LoadingRows = () => (
  <div aria-busy="true" className="grid gap-2 px-2 py-1">
    {[0, 1, 2].map((index) => (
      <div className="flex items-start gap-3 p-2" key={index}>
        <Skeleton className="size-8 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
    ))}
  </div>
);

interface NotificationsBodyProps {
  isError: boolean;
  isLoading: boolean;
  isMutating: boolean;
  items: UserNotification[] | null;
  now: number;
  unread: number;
  onDismiss: (id: string) => void;
  onDismissRead: () => void;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onOpen: (id: string) => void;
}

/**
 * The inside of the notification menu.
 *
 * Split from the bell so the menu's structure can be rendered on its own in a
 * test. Base UI's group label throws unless it is inside a group, and that
 * failure only happens once the menu is actually open, so a test that never
 * opened the menu would not have caught it.
 */
export const NotificationsBody = ({
  isError,
  isLoading,
  isMutating,
  items,
  now,
  onDismiss,
  onDismissRead,
  onMarkAllRead,
  onMarkRead,
  onOpen,
  unread,
}: NotificationsBodyProps) => {
  let content: ReactNode;

  if (isLoading && items === null) {
    content = <LoadingRows />;
  } else if (isError) {
    content = (
      <p className="text-muted-foreground px-3 py-6 text-center text-sm">
        Could not load your notifications.
      </p>
    );
  } else if (items === null || items.length === 0) {
    content = (
      <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
        <IconBellOff
          aria-hidden="true"
          className="text-muted-foreground size-7"
          stroke={1.5}
        />
        <p className="text-foreground text-sm font-medium">Nothing here yet</p>
        <p className="text-muted-foreground max-w-[16rem] text-sm">
          You are told when a moderator reviews one of your projects, and when
          they look at something you reported.
        </p>
      </div>
    );
  } else {
    // Grouped in one pass: the list is already newest-first, so a bucket only
    // has to remember which group it is currently filling.
    const buckets = new Map<NotificationGroup, UserNotification[]>();
    for (const item of items) {
      const group = notificationGroup(item.createdAt, now);
      const existing = buckets.get(group);
      if (existing) {
        existing.push(item);
      } else {
        buckets.set(group, [item]);
      }
    }

    content = (
      <div className="max-h-[26rem] overflow-y-auto py-1">
        {[...buckets].map(([group, grouped]) => (
          <NotificationGroupBlock
            group={group}
            isMutating={isMutating}
            items={grouped}
            key={group}
            now={now}
            onDismiss={onDismiss}
            onMarkRead={onMarkRead}
            onOpen={onOpen}
          />
        ))}
      </div>
    );
  }

  const footer =
    (items?.length ?? 0) > 0 && unread > 0 ? (
      <>
        <DropdownMenuSeparator className="border-border/70 my-1 border-t" />
        <DropdownMenuItem
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium"
          onClick={() => onMarkAllRead()}
        >
          <IconChecks size={16} stroke={1.8} aria-hidden="true" />
          Mark all as read
        </DropdownMenuItem>
      </>
    ) : null;

  const tidy =
    (items?.length ?? 0) > 0 && unread === 0 ? (
      <>
        <DropdownMenuSeparator className="border-border/70 my-1 border-t" />
        <DropdownMenuItem
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium"
          onClick={() => onDismissRead()}
        >
          <IconTrash size={16} stroke={1.8} aria-hidden="true" />
          Clear read notifications
        </DropdownMenuItem>
      </>
    ) : null;

  return (
    <>
      {/* The label is a Base UI GroupLabel, so it needs the group that supplies
          its context. Items and separators stay outside it, as in the user menu. */}
      <DropdownMenuGroup>
        <DropdownMenuLabel className="border-border/70 flex items-center justify-between border-b px-3 py-2.5">
          Notifications
          {unread > 0 ? (
            <span className="text-muted-foreground text-xs font-normal tabular-nums">
              {unread} unread
            </span>
          ) : null}
        </DropdownMenuLabel>
      </DropdownMenuGroup>

      {content}
      {footer}
      {tidy}
    </>
  );
};

/**
 * The signed-in user's notification bell.
 *
 * The badge comes from a dedicated count rather than from the loaded list,
 * because the list is capped while the count is not: a user with more unread
 * notifications than the list limit would otherwise be told they have exactly
 * as many as happen to fit.
 *
 * The count is a query rather than mount-time state so it is cached and shared
 * across route changes. As mount-time state it was a server round-trip on every
 * page, for a badge that almost never changes between two pages.
 */
export const UserNotifications = () => {
  const queryClient = useQueryClient();
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  /**
   * The rows plus the instant they were loaded.
   *
   * They belong together: "4 minutes ago" is only meaningful against a fixed
   * reference time, and holding the two separately lets one move without the
   * other. Stamping on load also makes the reference honest — it is when the
   * list was true, not when the panel happened to render.
   */
  const [panel, setPanel] = useState<Panel | null>(null);
  const items = panel?.items ?? null;
  const now = panel?.loadedAt ?? 0;

  const unreadQuery = useQuery({
    queryFn: countUnreadUserNotifications,
    queryKey: UNREAD_QUERY_KEY,
    staleTime: 60_000,
  });

  const unread = unreadQuery.data ?? 0;

  const settleCount = (count: number) => {
    queryClient.setQueryData(UNREAD_QUERY_KEY, count);
  };

  // Loaded on open rather than on mount: most visits never open it, and this
  // keeps the cost off every page load.
  const loadOnOpen = async (isOpen: boolean): Promise<void> => {
    if (!isOpen || panel !== null) {
      return;
    }
    setIsLoadingList(true);
    setLoadFailed(false);
    try {
      const loaded = await listUserNotifications();
      setPanel({ items: loaded, loadedAt: Date.now() });
    } catch {
      setLoadFailed(true);
      toast.error("Could not load your notifications.");
    }
    setIsLoadingList(false);
  };

  const markAllRead = async (): Promise<void> => {
    try {
      await markAllUserNotificationsRead();
      setPanel((current) =>
        current
          ? {
              ...current,
              items:
                current.items?.map((item) => ({
                  ...item,
                  isRead: true,
                })) ?? null,
            }
          : current
      );
      settleCount(0);
    } catch {
      toast.error("Could not mark your notifications as read.");
    }
  };

  /**
   * Marks one notification read without navigating to its project.
   *
   * The unread count is only decremented if the item actually was unread:
   * calling this on an already-read row would otherwise drift the badge below
   * the real count, and the next open would silently correct it.
   */
  const markItemRead = async (id: string): Promise<void> => {
    const target = items?.find((item) => item.id === id);
    if (!target || target.isRead) {
      return;
    }
    setPanel((current) =>
      current
        ? {
            ...current,
            items:
              current.items?.map((item) =>
                item.id === id ? { ...item, isRead: true } : item
              ) ?? null,
          }
        : current
    );
    settleCount(Math.max(0, unread - 1));
    try {
      await markUserNotificationRead({ data: { notificationId: id } });
    } catch {
      // The row already shows as read, and the next open reloads from the
      // database. Reporting here would be noise about something the user did.
      const reloaded = await listUserNotifications().catch(() => null);
      if (reloaded) {
        setPanel({ items: reloaded, loadedAt: Date.now() });
      }
      settleCount(await countUnreadUserNotifications().catch(() => 0));
    }
  };

  /** Opening a row is the same action as marking it read, plus navigating. */
  const openItem = async (id: string): Promise<void> => {
    await markItemRead(id);
  };

  /**
   * Removes a row outright.
   *
   * Optimistic, because the alternative is a row that stays on screen after it
   * has been dismissed, which reads as the control not working. Reverted from
   * the server if the write fails.
   */
  const dismissItem = useMutation({
    mutationFn: (id: string) =>
      dismissUserNotification({ data: { notificationId: id } }),
    onError: () => {
      toast.error("Could not dismiss that notification.");
      void queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY });
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: LIST_QUERY_KEY });
      const target = items?.find((item) => item.id === id);
      setPanel((current) =>
        current
          ? {
              ...current,
              items: current.items?.filter((item) => item.id !== id) ?? null,
            }
          : current
      );
      if (target && !target.isRead) {
        settleCount(Math.max(0, unread - 1));
      }
    },
  });

  /** Clears every read row at once. */
  const dismissRead = useMutation({
    mutationFn: () => dismissReadUserNotifications(),
    onError: () => {
      toast.error("Could not clear your notifications.");
      // Put back anything the optimistic filter removed.
      setPanel(null);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: UNREAD_QUERY_KEY });
    },
    onSuccess: () => {
      setPanel((current) =>
        current
          ? {
              ...current,
              items: current.items?.filter((item) => !item.isRead) ?? null,
            }
          : current
      );
    },
  });

  const hasUnread = unread > 0;
  const ariaLabel = hasUnread
    ? `Notifications, ${unread} unread`
    : "Notifications, none unread";
  const badgeText = unread > BADGE_MAX ? `${BADGE_MAX}+` : String(unread);
  const isMutating = dismissItem.isPending || dismissRead.isPending;

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

      <DropdownMenuContent align="end" sideOffset={8} className={PANEL_WIDTH}>
        <NotificationsBody
          isError={loadFailed}
          isLoading={isLoadingList}
          isMutating={isMutating}
          items={items}
          now={now}
          onDismiss={(id) => dismissItem.mutate(id)}
          onDismissRead={() => dismissRead.mutate()}
          onMarkAllRead={() => {
            void markAllRead();
          }}
          onMarkRead={(id) => {
            void markItemRead(id);
          }}
          onOpen={(id) => {
            void openItem(id);
          }}
          unread={unread}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
