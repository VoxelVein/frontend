import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import type { MinimumRole } from "@/lib/roles";

/**
 * Session-based role guards.
 *
 * Separate from `roles.ts`, which stays free of server imports so client
 * components can import the pure ladder without pulling in the database.
 */

export type StaffSession = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>;

/**
 * The caller's session, or null when they are signed out or below `minimum`.
 *
 * The non-throwing form, for read paths that render an empty panel rather than
 * an error.
 */
export const getRoleSession = async (
  minimum: MinimumRole
): Promise<StaffSession | null> => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session || !hasRole(session.user.role, minimum)) {
    return null;
  }
  return session;
};

/** The caller's session, or throws when below `minimum`. */
export const requireRole = async (
  minimum: MinimumRole
): Promise<StaffSession> => {
  const session = await getRoleSession(minimum);
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
};

const DENIAL = {
  admin: "Only admins can do this.",
  moderator: "Only staff can do this.",
  user: "You do not have access to this.",
} as const satisfies Record<MinimumRole, string>;

/**
 * The caller's session, or throws with a message naming the role that was
 * needed.
 *
 * Every staff endpoint goes through this rather than re-reading the session,
 * so a new admin surface cannot forget the check.
 */
export const requireStaff = async (
  minimum: Exclude<MinimumRole, "user">
): Promise<StaffSession> => {
  const session = await getRoleSession(minimum);
  if (!session) {
    throw new Error(DENIAL[minimum]);
  }
  return session;
};
