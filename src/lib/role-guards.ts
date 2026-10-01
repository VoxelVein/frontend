import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "@/lib/auth";
import { CAPABILITY_MINIMUM, hasRole } from "@/lib/roles";
import type { Capability, MinimumRole } from "@/lib/roles";

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
 * `requireCapability` is the better default for new endpoints, since it reads
 * its minimum from `CAPABILITY_MINIMUM`. This stays for the guards that are
 * genuinely about a rank rather than a job.
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

/**
 * The caller's session, or throws unless they hold a capability.
 *
 * The guard a new staff endpoint should reach for. It reads the minimum from
 * `CAPABILITY_MINIMUM` rather than taking a role, so the endpoint names the job
 * it protects — `requireCapability("manageUsers")` says why the check exists —
 * and the minimum rank is stated once, in one place, instead of being repeated
 * as `"admin"` at every guard.
 *
 * Pair it with `can()` on the client to hide what this refuses; neither is the
 * boundary on its own, and this one is the one that actually is.
 */
export const requireCapability = async (
  capability: Capability
): Promise<StaffSession> => {
  const session = await getRoleSession(CAPABILITY_MINIMUM[capability]);
  if (!session) {
    throw new Error(DENIAL[CAPABILITY_MINIMUM[capability]]);
  }
  return session;
};
