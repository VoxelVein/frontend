import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { object, parse, pipe, string, uuid } from "valibot";

import { db } from "@/db";
import { projects, userNotifications } from "@/db/schema";
import { auth } from "@/lib/auth";
import type { UserNotificationType } from "@/lib/notifications";
import type { Session } from "@/lib/project-access";

const NOTIFICATION_LIMIT = 50;

/**
 * Resolves any signed-in user.
 *
 * Deliberately weaker than `requireUploader`, which also demands a verified
 * email. A notification is something a user reads about their own account, so
 * requiring verified email to merely view it would be a surprise with no
 * upside.
 */
const requireUser = async (): Promise<Session> => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) {
    throw new Error("Sign in to see your notifications.");
  }
  return session;
};

export interface UserNotification {
  createdAt: string;
  id: string;
  isRead: boolean;
  message: string;
  /**
   * The project this is about, when it is about one. Null for a report outcome,
   * which has no project to point at. Cascading delete means a row about a
   * deleted project goes with it rather than dangling.
   */
  projectId: string | null;
  /** The project's name, so a row is identifiable without opening it. */
  projectName: string | null;
  /**
   * Where the row leads, or null when it leads nowhere. A report outcome is the
   * whole message; inventing a destination for it would send the reader
   * somewhere with nothing to show.
   */
  projectSlug: string | null;
  title: string;
  type: UserNotificationType;
}

/**
 * The row as the dropdown renders it.
 *
 * The project is joined in rather than fetched per row: a notification that says
 * "needs changes" without naming the project makes the reader open each one to
 * find out which, which is the opposite of a summary.
 */
/** The joined projection `listUserNotifications` selects. */
type NotificationRow = Pick<
  typeof userNotifications.$inferSelect,
  "createdAt" | "id" | "message" | "projectId" | "readAt" | "title" | "type"
> & {
  projectName: string | null;
  projectSlug: string | null;
};

const toNotification = (row: NotificationRow): UserNotification => ({
  createdAt: row.createdAt.toISOString(),
  id: row.id,
  isRead: row.readAt !== null,
  message: row.message,
  projectId: row.projectId,
  projectName: row.projectName,
  projectSlug: row.projectSlug,
  title: row.title,
  type: row.type,
});

/** The signed-in user's notifications, newest first. */
export const listUserNotifications = createServerFn({
  method: "GET",
}).handler(async (): Promise<UserNotification[]> => {
  const session = await requireUser();
  const rows = await db
    .select({
      createdAt: userNotifications.createdAt,
      id: userNotifications.id,
      message: userNotifications.message,
      projectId: userNotifications.projectId,
      projectName: projects.name,
      projectSlug: projects.slug,
      readAt: userNotifications.readAt,
      title: userNotifications.title,
      type: userNotifications.type,
    })
    .from(userNotifications)
    .leftJoin(projects, eq(projects.id, userNotifications.projectId))
    .where(eq(userNotifications.userId, session.user.id))
    .orderBy(desc(userNotifications.createdAt))
    .limit(NOTIFICATION_LIMIT);
  return rows.map(toNotification);
});

/** Unread count for the navbar badge. */
export const countUnreadUserNotifications = createServerFn({
  method: "GET",
}).handler(async (): Promise<number> => {
  const session = await requireUser();
  const [row] = await db
    .select({ unread: count() })
    .from(userNotifications)
    .where(
      and(
        eq(userNotifications.userId, session.user.id),
        isNull(userNotifications.readAt)
      )
    );
  return row?.unread ?? 0;
});

const notificationIdSchema = object({
  notificationId: pipe(string(), uuid()),
});

export const markUserNotificationRead = createServerFn({ method: "POST" })
  .validator((data: { notificationId: string }) =>
    parse(notificationIdSchema, data)
  )
  .handler(async ({ data }): Promise<void> => {
    const session = await requireUser();
    await db
      .update(userNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(userNotifications.id, data.notificationId),
          // Scoped to the caller so one user cannot mark another's notification
          // read by guessing an id.
          eq(userNotifications.userId, session.user.id)
        )
      );
  });

export const markAllUserNotificationsRead = createServerFn({
  method: "POST",
}).handler(async (): Promise<void> => {
  const session = await requireUser();
  await db
    .update(userNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(userNotifications.userId, session.user.id),
        isNull(userNotifications.readAt)
      )
    );
});

/**
 * Removes a notification from the list entirely.
 *
 * Separate from marking it read, and the reason is that a read notification
 * that stays forever is how a list becomes something nobody opens: "mark all as
 * read" clears the badge and leaves the same rows in place, so the next visit
 * looks identical to the one before. Dismissing is the only way the list gets
 * shorter, and without it the list silently fills to its 50-row cap and stops
 * showing anything new.
 */
export const dismissUserNotification = createServerFn({ method: "POST" })
  .validator((data: { notificationId: string }) =>
    parse(notificationIdSchema, data)
  )
  .handler(async ({ data }): Promise<void> => {
    const session = await requireUser();
    await db
      .delete(userNotifications)
      .where(
        and(
          eq(userNotifications.id, data.notificationId),
          eq(userNotifications.userId, session.user.id)
        )
      );
  });

/** Removes every notification the account has already read. */
export const dismissReadUserNotifications = createServerFn({
  method: "POST",
}).handler(async (): Promise<void> => {
  const session = await requireUser();
  await db.delete(userNotifications).where(
    and(
      eq(userNotifications.userId, session.user.id),
      // Only read ones: clearing an unread row would discard it before the
      // reader has had a chance to see it, which is not what "tidy up" means.
      isNotNull(userNotifications.readAt)
    )
  );
});
