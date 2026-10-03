/**
 * The kinds of notification a user can receive.
 *
 * Kept deliberately small and explicit. A new kind is added here rather than
 * being inferred from a string at the call site, so the column stays typed and
 * an unknown value from an older row cannot be silently treated as valid.
 *
 * Every kind has to answer one question: what would the person want to do next?
 * A kind that only reports a fact they can already see somewhere else is noise,
 * which is why none of these restate a status change. "It is now listed on the
 * site" told the reader nothing they could not see for themselves.
 */
export const USER_NOTIFICATION_TYPES = [
  /** An admin approved a project the user submitted for review. */
  "project-approved",
  /** An admin sent a submitted project back to draft, with a reason. */
  "project-rejected",
  /** A moderator closed a report the user filed as actioned. */
  "report-resolved",
  /** A moderator looked at a report the user filed and disagreed with it. */
  "report-dismissed",
] as const;

export type UserNotificationType = (typeof USER_NOTIFICATION_TYPES)[number];

/**
 * How a kind is presented.
 *
 * `tone` drives the icon tile and the unread row background, so the two always
 * agree, and it is the only place a kind's appearance is decided.
 */
export type NotificationTone = "positive" | "attention" | "neutral";

interface NotificationPresentation {
  /**
   * One line for the reader, in the site's second person rather than the
   * system's: "Your report was actioned" beats "Report resolved".
   */
  headline: string;
  tone: NotificationTone;
}

/**
 * Presentation per kind, keyed by the type so a missing entry is a compile
 * error rather than a row that quietly renders with no icon.
 */
const PRESENTATION = {
  "project-approved": {
    headline: "Project approved",
    tone: "positive",
  },
  "project-rejected": {
    headline: "Project needs changes",
    tone: "attention",
  },
  "report-dismissed": {
    headline: "Report dismissed",
    tone: "neutral",
  },
  "report-resolved": {
    headline: "Report actioned",
    tone: "positive",
  },
} as const satisfies Record<UserNotificationType, NotificationPresentation>;

/** What an unrecognised kind renders as. See `presentationFor`. */
const UNKNOWN_PRESENTATION: NotificationPresentation = {
  headline: "Notification",
  tone: "neutral",
};

/**
 * How a stored kind is presented.
 *
 * Falls back rather than throwing: a row written by a newer version of the app
 * should still render with a plain icon when an older one reads it, not blank
 * the panel out because it recognises a kind it predates.
 */
const isKnownNotificationType = (
  value: string
): value is UserNotificationType => value in PRESENTATION;

const presentationFor = (type: string): NotificationPresentation =>
  isKnownNotificationType(type) ? PRESENTATION[type] : UNKNOWN_PRESENTATION;

/**
 * Day grouping for the list.
 *
 * "Today" rather than a date, because the question a reader has about a
 * notification is "is this new?", and a date answers it only by making them do
 * the arithmetic. Anything older than yesterday falls back to an absolute date,
 * which is where a relative label stops helping.
 */
export type NotificationGroup = "today" | "yesterday" | "earlier";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Which day bucket a timestamp falls in, measured against whole local days.
 *
 * Compared against the start of today rather than against "24 hours ago", so a
 * notification from 11pm last night reads as "Yesterday" at 9am rather than
 * sliding into "Earlier" and then jumping back as the hours pass.
 */
export const notificationGroup = (
  value: Date | string,
  now: number = Date.now()
): NotificationGroup => {
  const then = new Date(value);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  if (then.getTime() >= startOfToday.getTime()) {
    return "today";
  }

  const startOfYesterday = startOfToday.getTime() - DAY_IN_MS;
  if (then.getTime() >= startOfYesterday) {
    return "yesterday";
  }

  return "earlier";
};

const groupLabels = {
  earlier: "Earlier",
  today: "Today",
  yesterday: "Yesterday",
} as const satisfies Record<NotificationGroup, string>;

export { presentationFor };

/** The visible heading for a group. */
export const notificationGroupLabel = (group: NotificationGroup): string =>
  groupLabels[group];
