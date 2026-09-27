/**
 * The kinds of notification a user can receive.
 *
 * Kept deliberately small and explicit. A new kind is added here rather than
 * being inferred from a string at the call site, so the column stays typed and
 * an unknown value from an older row cannot be silently treated as valid.
 */
export const USER_NOTIFICATION_TYPES = [
  /** An admin approved a project the user submitted for review. */
  "project-approved",
  /** An admin sent a submitted project back to draft, with a reason. */
  "project-rejected",
] as const;

export type UserNotificationType = (typeof USER_NOTIFICATION_TYPES)[number];
