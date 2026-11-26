import { IconChecks, IconTrash } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { presentationFor } from "@/lib/notifications";
import { relativeTime } from "@/lib/relative-time";
import type { UserNotification } from "@/lib/user-notifications.functions";
import { cn } from "@/lib/utils";

import { TONE_CLASS, TONE_ICON } from "./notification-tone";

export interface InboxRowProps {
  isMutating: boolean;
  item: UserNotification;
  now: number;
  onDismiss: (id: string) => void;
  onMarkRead: (id: string) => void;
  onOpen: (id: string) => void;
}

/**
 * A notification as a list row, not as a second card.
 *
 * The bell needs a self-contained tile because it floats over the page. Here
 * the row sits inside one card, so it uses a divider instead of a border and a
 * left accent instead of a tinted background. The destination link still wraps
 * only the text: the mark-read and dismiss buttons stay separate controls.
 */
const InboxRow = ({
  isMutating,
  item,
  now,
  onDismiss,
  onMarkRead,
  onOpen,
}: InboxRowProps) => {
  const { tone } = presentationFor(item.type);
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
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          TONE_CLASS[tone]
        )}
      >
        <Icon size={17} stroke={1.8} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {item.isRead ? (
            <span className="sr-only">Read:</span>
          ) : (
            <>
              <span
                aria-hidden="true"
                className="bg-primary size-1.5 shrink-0 rounded-full"
              />
              <span className="sr-only">Unread:</span>
            </>
          )}
          <span
            className={cn(
              "text-sm font-medium",
              item.isRead ? "text-foreground/80" : "text-foreground"
            )}
          >
            {item.title}
          </span>
          <time
            className="text-muted-foreground ml-auto text-xs whitespace-nowrap"
            dateTime={item.createdAt}
            title={absolute}
          >
            {relativeTime(item.createdAt, now)}
          </time>
        </span>

        <span className="text-muted-foreground mt-1 block text-sm leading-6">
          {item.message}
        </span>

        {item.projectName ? (
          <span className="border-border/70 bg-muted/40 text-muted-foreground mt-2 inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs">
            <span className="truncate">{item.projectName}</span>
          </span>
        ) : null}
      </span>
    </>
  );

  let linkedBody: ReactNode;

  if (isTransfer) {
    linkedBody = (
      <Link
        className="focus-visible:ring-ring flex min-w-0 flex-1 gap-3 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => onOpen(item.id)}
        to="/dashboard/transfers"
      >
        {body}
        <span className="sr-only">
          Open your transfers, created {absolute}.
        </span>
      </Link>
    );
  } else if (canOpen) {
    linkedBody = (
      <Link
        className="focus-visible:ring-ring flex min-w-0 flex-1 gap-3 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => onOpen(item.id)}
        params={{ projectId: item.projectId ?? "" }}
        to="/dashboard/projects/$projectId"
      >
        {body}
        <span className="sr-only">
          Open {item.projectName}, created {absolute}.
        </span>
      </Link>
    );
  } else {
    linkedBody = <div className="flex min-w-0 flex-1 gap-3">{body}</div>;
  }

  return (
    <div
      className={cn(
        "border-border/60 flex items-start gap-2 border-b py-4 last:border-b-0",
        item.isRead ? "" : "border-l-primary -ml-4 border-l-2 pl-4"
      )}
    >
      {linkedBody}

      <span className="flex shrink-0 items-center gap-0.5">
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
      </span>
    </div>
  );
};

export { InboxRow };
