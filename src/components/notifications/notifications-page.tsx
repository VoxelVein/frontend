import {
  IconBell,
  IconChecks,
  IconSearch,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/error-state";
import { InboxRow } from "@/components/notifications/inbox-row";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  groupNotifications,
  notificationGroupLabel,
} from "@/lib/notifications";
import { USER_NOTIFICATION_KEYS } from "@/lib/user-notification-keys";
import type { UserNotification } from "@/lib/user-notifications.functions";
import {
  countUnreadUserNotifications,
  dismissReadUserNotifications,
  dismissUserNotification,
  listUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
} from "@/lib/user-notifications.functions";

const FILTERS = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "Read", value: "read" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

const matchesSearch = (item: UserNotification, term: string) => {
  if (!term) {
    return true;
  }

  return [item.title, item.message, item.projectName ?? ""].some((value) =>
    value.toLowerCase().includes(term)
  );
};

/**
 * Applies the toolbar's two rules in one place, so the page component only has
 * to decide what to render and the rules stay independent of the query state.
 */
const filterNotifications = (
  items: readonly UserNotification[],
  filter: Filter,
  term: string
): UserNotification[] =>
  items.filter((item) => {
    if (filter === "unread" && item.isRead) {
      return false;
    }

    if (filter === "read" && !item.isRead) {
      return false;
    }

    return matchesSearch(item, term);
  });

const LoadingRows = () => (
  <div aria-busy="true" className="grid gap-4 px-4 py-6">
    {[0, 1, 2, 3].map((index) => (
      <div className="flex items-start gap-3" key={index}>
        <Skeleton className="size-9 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * An empty inbox is a blank area inside the card, not another card inside it.
 */
const InboxEmptyState = ({
  isFiltered,
  onClear,
}: {
  isFiltered: boolean;
  onClear: () => void;
}) => (
  <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
    <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
      <IconBell size={22} aria-hidden="true" />
    </span>
    <p className="text-foreground font-medium">
      {isFiltered ? "No matching notifications" : "Nothing here yet"}
    </p>
    <p className="text-muted-foreground max-w-sm text-sm">
      {isFiltered
        ? "Try a different search or show every notification."
        : "You are told when a moderator reviews one of your projects, and when they look at something you reported."}
    </p>
    {isFiltered ? (
      <Button variant="link" onClick={onClear}>
        Show all
      </Button>
    ) : null}
  </div>
);

interface NotificationToolbarProps {
  filter: Filter;
  hasRead: boolean;
  isMutating: boolean;
  onClearRead: () => void;
  onFilterChange: (filter: Filter) => void;
  onSearchChange: (value: string) => void;
  search: string;
}

const NotificationToolbar = ({
  filter,
  hasRead,
  isMutating,
  onClearRead,
  onFilterChange,
  onSearchChange,
  search,
}: NotificationToolbarProps) => (
  <div className="border-border/70 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
    <Tabs
      value={filter}
      onValueChange={(value) => {
        const next = FILTERS.find((entry) => entry.value === value);

        if (next) {
          onFilterChange(next.value);
        }
      }}
    >
      <TabsList>
        {FILTERS.map((entry) => (
          <TabsTrigger key={entry.value} value={entry.value}>
            {entry.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>

    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <InputGroup className="bg-background w-full sm:w-64">
        <InputGroupAddon>
          <IconSearch size={16} aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search notifications"
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search notifications"
        />
        {search ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-label="Clear search"
              onClick={() => onSearchChange("")}
              size="icon-sm"
            >
              <IconX size={16} aria-hidden="true" />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-11"
        disabled={!hasRead || isMutating}
        onClick={onClearRead}
      >
        <IconTrash size={16} aria-hidden="true" />
        Clear read
      </Button>
    </div>
  </div>
);

/**
 * The full notification inbox.
 *
 * The bell stays a quick glance with a 50-row cap; this page is where a reader
 * filters, searches and acts on the rows. Both views write through the same
 * query keys, so a change here also updates the badge in the navbar.
 */
const NotificationsPage = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const listQuery = useQuery({
    queryFn: listUserNotifications,
    queryKey: USER_NOTIFICATION_KEYS.page,
    staleTime: 30_000,
  });

  const unreadQuery = useQuery({
    queryFn: countUnreadUserNotifications,
    queryKey: USER_NOTIFICATION_KEYS.unread,
    staleTime: 60_000,
  });

  const items = listQuery.data ?? [];
  const unreadCount = unreadQuery.data ?? 0;
  // One reference time for every relative timestamp on the page, so they do
  // not shift as individual rows render. Rows only render once the query has
  // data, which is when this timestamp is set.
  const now = listQuery.dataUpdatedAt;
  const term = search.trim().toLowerCase();
  const visible = filterNotifications(items, filter, term);

  const settle = () => {
    void queryClient.invalidateQueries({
      queryKey: USER_NOTIFICATION_KEYS.all,
    });
  };

  const markOne = useMutation({
    mutationFn: (id: string) =>
      markUserNotificationRead({ data: { notificationId: id } }),
    onError: () => toast.error("Could not mark that notification as read."),
    onSuccess: () => {
      toast.success("Notification marked as read.");
      settle();
    },
  });

  const markAll = useMutation({
    mutationFn: () => markAllUserNotificationsRead(),
    onError: () => toast.error("Could not mark your notifications as read."),
    onSuccess: () => {
      toast.success("All notifications marked as read.");
      settle();
    },
  });

  const dismissOne = useMutation({
    mutationFn: (id: string) =>
      dismissUserNotification({ data: { notificationId: id } }),
    onError: () => toast.error("Could not dismiss that notification."),
    onSuccess: () => {
      toast.success("Notification dismissed.");
      settle();
    },
  });

  const dismissRead = useMutation({
    mutationFn: () => dismissReadUserNotifications(),
    onError: () => toast.error("Could not clear your notifications."),
    onSuccess: () => {
      toast.success("Read notifications cleared.");
      settle();
    },
  });

  const isMutating =
    markOne.isPending ||
    markAll.isPending ||
    dismissOne.isPending ||
    dismissRead.isPending;

  const hasRead = items.some((item) => item.isRead);
  const isFiltered = filter !== "all" || term.length > 0;

  const clearFilters = () => {
    setFilter("all");
    setSearch("");
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="Notifications"
        description="Everything the team has told you about your projects and reports."
        icon={
          <span className="border-primary/20 bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl border">
            <IconBell size={22} aria-hidden="true" />
          </span>
        }
      />

      <Card className="mt-8" size="sm">
        <CardHeader className="border-border/70 border-b">
          <CardTitle className="text-lg">Inbox</CardTitle>
          <CardDescription>
            Your latest project and report updates, newest first.
          </CardDescription>
          <CardAction className="flex flex-wrap items-center gap-2">
            {unreadCount > 0 ? (
              <Badge variant="secondary">
                <span className="tabular-nums">{unreadCount}</span> unread
              </Badge>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={unreadCount === 0 || isMutating}
              onClick={() => markAll.mutate()}
            >
              <IconChecks size={16} aria-hidden="true" />
              Read all
            </Button>
          </CardAction>
        </CardHeader>

        <NotificationToolbar
          filter={filter}
          hasRead={hasRead}
          isMutating={isMutating}
          onClearRead={() => dismissRead.mutate()}
          onFilterChange={setFilter}
          onSearchChange={setSearch}
          search={search}
        />

        <CardContent className="pt-2 pb-5">
          {listQuery.isPending ? <LoadingRows /> : null}

          {listQuery.isError ? (
            <div className="py-10 text-center">
              <p className="text-muted-foreground mb-3 text-sm">
                Could not load your notifications.
              </p>
              <ErrorState
                message="Could not load your notifications."
                onRetry={async () => {
                  await listQuery.refetch();
                }}
              />
            </div>
          ) : null}

          {listQuery.isSuccess && visible.length === 0 ? (
            <InboxEmptyState isFiltered={isFiltered} onClear={clearFilters} />
          ) : null}

          {listQuery.isSuccess && visible.length > 0
            ? groupNotifications(visible, now).map(([group, grouped]) => (
                <div className="pt-4 first:pt-0" key={group}>
                  <h2 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                    {notificationGroupLabel(group)}
                  </h2>
                  <ul>
                    {grouped.map((item) => (
                      <li key={item.id}>
                        <InboxRow
                          isMutating={isMutating}
                          item={item}
                          now={now}
                          onDismiss={(id) => dismissOne.mutate(id)}
                          onMarkRead={(id) => markOne.mutate(id)}
                          onOpen={(id) => markOne.mutate(id)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            : null}
        </CardContent>
      </Card>

      {items.length === 50 ? (
        <p className="text-muted-foreground mt-4 text-xs">
          Showing your 50 most recent notifications.
        </p>
      ) : null}
    </div>
  );
};

export { NotificationsPage };
