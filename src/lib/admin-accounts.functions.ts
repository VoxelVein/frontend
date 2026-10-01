import { createServerFn } from "@tanstack/react-start";
import { count, desc, eq, isNull } from "drizzle-orm";
import { object, parse, pipe, string, uuid } from "valibot";

import { db } from "@/db";
import { adminNotifications } from "@/db/schema";
import {
  AccountError,
  listPendingDeletions as listPendingDeletionsFromDb,
  restoreAccount as restoreAccountInDb,
} from "@/lib/account-lifecycle";
import type { PendingDeletion } from "@/lib/account-lifecycle";
import { requireCapability } from "@/lib/role-guards";
import type { Capability } from "@/lib/roles";

const NOTIFICATION_LIMIT = 100;

/**
 * Restoring a scheduled deletion and reading the shared inbox stay
 * admin-only: neither is part of moderating content, and a restore reverses a
 * destructive decision.
 *
 * Translates the guard's own error into an `AccountError` so these endpoints
 * report a message the settings and admin surfaces already render, rather than
 * a bare `Error` from the shared guard.
 */
const requireAccountCapability = async (capability: Capability) => {
  try {
    return await requireCapability(capability);
  } catch {
    throw new AccountError("Only admins can do this.");
  }
};

const userIdSchema = object({ userId: string() });
const notificationIdSchema = object({ id: pipe(string(), uuid()) });

export const listPendingDeletions = createServerFn({ method: "GET" }).handler(
  async (): Promise<PendingDeletion[]> => {
    await requireAccountCapability("manageDeletions");
    return listPendingDeletionsFromDb();
  }
);

/** Cancels a scheduled deletion and lets the user sign in again. */
export const restoreAccount = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => parse(userIdSchema, data))
  .handler(async ({ data }): Promise<void> => {
    await requireAccountCapability("manageDeletions");
    await restoreAccountInDb(data.userId);
  });

export interface AdminNotification {
  createdAt: string;
  id: string;
  message: string;
  projectId: string | null;
  readAt: string | null;
  title: string;
  type: string;
  userId: string | null;
}

export const listAdminNotifications = createServerFn({
  method: "GET",
}).handler(async (): Promise<AdminNotification[]> => {
  await requireAccountCapability("manageNotifications");
  const rows = await db
    .select()
    .from(adminNotifications)
    .orderBy(desc(adminNotifications.createdAt))
    .limit(NOTIFICATION_LIMIT);
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  }));
});

export const countUnreadAdminNotifications = createServerFn({
  method: "GET",
}).handler(async (): Promise<number> => {
  await requireAccountCapability("manageNotifications");
  const [row] = await db
    .select({ unread: count() })
    .from(adminNotifications)
    .where(isNull(adminNotifications.readAt));
  return row?.unread ?? 0;
});

export const markAdminNotificationRead = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => parse(notificationIdSchema, data))
  .handler(async ({ data }): Promise<void> => {
    await requireAccountCapability("manageNotifications");
    await db
      .update(adminNotifications)
      .set({ readAt: new Date() })
      .where(eq(adminNotifications.id, data.id));
  });

export const markAllAdminNotificationsRead = createServerFn({
  method: "POST",
}).handler(async (): Promise<void> => {
  await requireAccountCapability("manageNotifications");
  await db
    .update(adminNotifications)
    .set({ readAt: new Date() })
    .where(isNull(adminNotifications.readAt));
});
