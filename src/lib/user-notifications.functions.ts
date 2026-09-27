import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { object, parse, pipe, string, uuid } from "valibot";

import { db } from "@/db";
import { userNotifications } from "@/db/schema";
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
   * The project this is about. The column is NOT NULL with a cascading delete,
   * so the row disappears along with the project and a notification can never
   * point at something that no longer exists.
   */
  projectId: string;
  title: string;
  type: UserNotificationType;
}

const toNotification = (
  row: typeof userNotifications.$inferSelect
): UserNotification => ({
  createdAt: row.createdAt.toISOString(),
  id: row.id,
  isRead: row.readAt !== null,
  message: row.message,
  projectId: row.projectId,
  title: row.title,
  type: row.type,
});

/** The signed-in user's notifications, newest first. */
export const listUserNotifications = createServerFn({
  method: "GET",
}).handler(async (): Promise<UserNotification[]> => {
  const session = await requireUser();
  const rows = await db
    .select()
    .from(userNotifications)
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
