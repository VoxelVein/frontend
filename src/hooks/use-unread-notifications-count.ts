import { useQuery } from "@tanstack/react-query";

import { USER_NOTIFICATION_KEYS } from "@/lib/user-notification-keys";
import { countUnreadUserNotifications } from "@/lib/user-notifications.functions";

/** Badges rarely change between two pages, so reuse the count for a minute. */
const STALE_TIME_MS = 60_000;

/**
 * The unread count for the navbar avatar badge.
 *
 * The bell, the badge and the full page all use this one query key, so marking
 * a row read anywhere clears every view of the count. `enabled` keeps the
 * request from firing for signed-out visitors, who have no inbox to count.
 */
const useUnreadNotificationsCount = (enabled = true): number => {
  const { data } = useQuery({
    enabled,
    queryFn: countUnreadUserNotifications,
    queryKey: USER_NOTIFICATION_KEYS.unread,
    staleTime: STALE_TIME_MS,
  });

  return data ?? 0;
};

export { useUnreadNotificationsCount };
