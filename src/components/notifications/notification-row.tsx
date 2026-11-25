import {
  IconChecks,
  IconCircleCheck,
  IconInfoCircle,
  IconMessageReport,
  IconTrash,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { NotificationTone } from "@/lib/notifications";
import { presentationFor } from "@/lib/notifications";
import { relativeTime } from "@/lib/relative-time";
import type { UserNotification } from "@/lib/user-notifications.functions";
import { cn } from "@/lib/utils";

/** Icon and tint per kind, shared by the bell and the full page. */
const TONE_ICON = {
  attention: IconMessageReport,
  neutral: IconInfoCircle,
  positive: IconCircleCheck,
} as const satisfies Record<NotificationTone, typeof IconInfoCircle>;

const TONE_CLASS = {
  attention: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
  positive: "bg-primary/10 text-primary",
} as const satisfies Record<NotificationTone, string>;

/** The row's own background, so an unread row reads as unread at a glance. */
const ROW_CLASS = {
  read: "border-transparent hover:bg-muted/60",
  unread: "border-primary/15 bg-primary/5 hover:bg-primary/10",
} as const;

export interface NotificationRowProps {
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
 * link, which is invalid and unusable by keyboard. The same component renders
 * on the full page, where no menu context exists at all.
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

  const isTransfer =
    item.type === "project-transfer-offered" ||
    item.type === "project-transfer-accepted" ||
    item.type === "project-transfer-declined";

  const canOpen = isTransfer || item.projectSlug !== null;
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

  let linkedBody: ReactNode;

  if (isTransfer) {
    linkedBody = (
      <Link
        className="focus-visible:ring-ring min-w-0 flex-1 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => onOpen(item.id)}
        to="/dashboard/transfers"
      >
        {body}
        <span className="sr-only">
          {headline}. Open your transfers, created {absolute}.
        </span>
      </Link>
    );
  } else if (canOpen) {
    linkedBody = (
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
    );
  } else {
    // No destination, so not a link: a control that goes nowhere is worse
    // than no control, and the message is the whole notification.
    linkedBody = <div className="min-w-0 flex-1">{body}</div>;
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-2.5 transition-colors",
        ROW_CLASS[item.isRead ? "read" : "unread"]
      )}
    >
      {linkedBody}

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

export { NotificationRow };
