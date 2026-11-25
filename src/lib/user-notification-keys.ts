/**
 * Query keys for the user's notifications.
 *
 * The bell and the full page write to the same queries: marking one row read in
 * one place has to clear the badge in the other. Keeping the keys here means a
 * rename cannot be applied to only one of them.
 */
const PREFIX = "user-notifications";

export const USER_NOTIFICATION_KEYS = {
  all: [PREFIX] as const,
  list: [PREFIX, "list"] as const,
  page: [PREFIX, "page"] as const,
  unread: [PREFIX, "unread"] as const,
} as const;
