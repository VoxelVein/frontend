import { IconBell, IconCheck } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import {
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  Card,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from "@/lib/admin-accounts.functions";
import type { AdminNotification } from "@/lib/admin-accounts.functions";
import { errorMessage } from "@/lib/form-errors";

const absoluteFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;
const MS_PER_SECOND = 1000;

/** ISO timestamp -> "3 hours ago", measured against `now`. */
const formatRelative = (value: string, now: number): string => {
  const seconds = Math.round((new Date(value).getTime() - now) / MS_PER_SECOND);
  const magnitude = Math.abs(seconds);
  if (magnitude < SECONDS_PER_MINUTE) {
    return relativeFormatter.format(seconds, "second");
  }
  if (magnitude < SECONDS_PER_HOUR) {
    return relativeFormatter.format(
      Math.round(seconds / SECONDS_PER_MINUTE),
      "minute"
    );
  }
  if (magnitude < SECONDS_PER_DAY) {
    return relativeFormatter.format(
      Math.round(seconds / SECONDS_PER_HOUR),
      "hour"
    );
  }
  return relativeFormatter.format(Math.round(seconds / SECONDS_PER_DAY), "day");
};

interface NotificationItemProps {
  isMutating: boolean;
  loadedAt: number;
  notification: AdminNotification;
  onMarkRead: (id: string) => void;
}

const NotificationItem = ({
  isMutating,
  loadedAt,
  notification,
  onMarkRead,
}: NotificationItemProps) => {
  const isUnread = notification.readAt === null;
  const headingId = `notification-${notification.id}-title`;

  return (
    <li>
      <article
        aria-labelledby={headingId}
        className={
          isUnread
            ? "border-primary/40 bg-card flex flex-wrap items-start gap-3 rounded-lg border p-4"
            : "border-border bg-muted/40 flex flex-wrap items-start gap-3 rounded-lg border p-4"
        }
      >
        <div className="min-w-0 flex-1">
          <h3
            id={headingId}
            className="text-foreground flex flex-wrap items-center gap-2 text-sm font-medium"
          >
            {isUnread ? (
              <span className="border-primary bg-primary text-primary-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium tracking-wide uppercase">
                Unread
              </span>
            ) : null}
            <span>{notification.title}</span>
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {notification.message}
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            <time
              dateTime={notification.createdAt}
              title={absoluteFormatter.format(new Date(notification.createdAt))}
            >
              {formatRelative(notification.createdAt, loadedAt)}
            </time>{" "}
            · {absoluteFormatter.format(new Date(notification.createdAt))}
          </p>
        </div>

        {isUnread ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 shrink-0"
            disabled={isMutating}
            onClick={() => onMarkRead(notification.id)}
          >
            <IconCheck size={16} aria-hidden="true" />
            Mark as read
            <span className="sr-only">: {notification.title}</span>
          </Button>
        ) : null}
      </article>
    </li>
  );
};

interface ListState {
  error: string | null;
  isLoading: boolean;
  /** When the rows were fetched; relative times are measured from it. */
  loadedAt: number;
  rows: AdminNotification[];
}

const LOADING_STATE: ListState = {
  error: null,
  isLoading: true,
  loadedAt: 0,
  rows: [],
};

const fetchNotifications = async (): Promise<ListState> => {
  try {
    // The server returns the inbox newest first.
    const rows = await listAdminNotifications();
    return { error: null, isLoading: false, loadedAt: Date.now(), rows };
  } catch (error) {
    return {
      error: errorMessage(error, "Could not load notifications."),
      isLoading: false,
      loadedAt: 0,
      rows: [],
    };
  }
};

interface AdminNotificationsProps {
  /** Called after notifications were marked read, so badges can refresh. */
  onReadStateChange?: () => void;
}

export const AdminNotifications = ({
  onReadStateChange,
}: AdminNotificationsProps) => {
  const [isMutating, setIsMutating] = useState(false);

  const [list, setList] = useState<ListState>(LOADING_STATE);
  const { error: loadError, isLoading, rows: notifications, loadedAt } = list;

  useEffect(() => {
    let isCurrent = true;
    const loadOnMount = async () => {
      const next = await fetchNotifications();
      if (isCurrent) {
        setList(next);
      }
    };
    void loadOnMount();
    return () => {
      isCurrent = false;
    };
  }, []);

  const load = async () => {
    setList((current) => ({ ...current, error: null, isLoading: true }));
    const next = await fetchNotifications();
    setList(next);
  };

  const markRead = async (id: string) => {
    setIsMutating(true);
    try {
      await markAdminNotificationRead({ data: { id } });
      const readAt = new Date().toISOString();
      setList((current) => ({
        ...current,
        rows: current.rows.map((item) =>
          item.id === id ? { ...item, readAt } : item
        ),
      }));
      onReadStateChange?.();
    } catch (error) {
      toast.error(errorMessage(error, "Could not mark notification as read."));
    }
    setIsMutating(false);
  };

  const markAllRead = async () => {
    setIsMutating(true);
    try {
      await markAllAdminNotificationsRead();
      const readAt = new Date().toISOString();
      setList((current) => ({
        ...current,
        rows: current.rows.map((item) => ({
          ...item,
          readAt: item.readAt ?? readAt,
        })),
      }));
      onReadStateChange?.();
    } catch (error) {
      toast.error(errorMessage(error, "Could not mark notifications as read."));
    }
    setIsMutating(false);
  };

  const unreadCount = notifications.filter(
    (item) => item.readAt === null
  ).length;

  let content: ReactNode;

  if (isLoading) {
    content = (
      <div aria-busy="true" className="mt-4 grid gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  } else if (loadError) {
    content = <ErrorState message={loadError} onRetry={() => load()} />;
  } else if (notifications.length === 0) {
    content = (
      <EmptyState
        variant="inline"
        title="No notifications"
        description="You will be notified here when a large project loses its owner."
        icon={<IconBell size={20} aria-hidden="true" />}
      />
    );
  } else {
    content = (
      <ul aria-label="Notifications, newest first" className="mt-4 grid gap-3">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            isMutating={isMutating}
            loadedAt={loadedAt}
            notification={notification}
            onMarkRead={markRead}
          />
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby="admin-notifications-heading">
      <Card>
        <CardHeader>
          <h2
            id="admin-notifications-heading"
            className="text-foreground text-lg font-semibold"
          >
            Notifications
          </h2>
          <CardDescription>
            Account and project events that need an admin&apos;s attention.
          </CardDescription>
          <CardAction className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={isMutating || unreadCount === 0}
              onClick={() => markAllRead()}
            >
              Mark all as read
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              disabled={isLoading}
              onClick={() => load()}
            >
              Refresh
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>{content}</CardContent>
      </Card>
    </section>
  );
};
