import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { accounts } from "@/db/schema";
import { AccountError } from "@/lib/account-lifecycle";
import { auth } from "@/lib/auth";
import type { Session } from "@/lib/project-access";

/**
 * Session and re-authentication helpers for project transfers only.
 *
 * Kept in its own module because it imports server request headers. The
 * account functions file is reachable from client routes, so exporting these
 * helpers from there would pull `@tanstack/react-start/server` into the browser
 * bundle and fail the build's import-protection check.
 */

export const REAUTH_WINDOW_MS = 10 * 60 * 1000;

export const requireSession = async (): Promise<Session> => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });

  if (!session) {
    throw new AccountError("Sign in to manage your projects.");
  }

  return session;
};

const verifyPassword = async (
  userId: string,
  password: string
): Promise<boolean> => {
  const [credential] = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), eq(accounts.providerId, "credential"))
    )
    .limit(1);

  if (!credential?.password) {
    return false;
  }

  const context = await auth.$context;

  return context.password.verify({ hash: credential.password, password });
};

const reauthenticatedUntil = (session: Session): Date =>
  new Date(new Date(session.session.createdAt).getTime() + REAUTH_WINDOW_MS);

/** A password, or a sign-in within the re-auth window, proves it is the owner. */
export const verifyReauthentication = (
  session: Session,
  password?: string
): Promise<boolean> =>
  password
    ? verifyPassword(session.user.id, password)
    : Promise.resolve(reauthenticatedUntil(session) > new Date());
