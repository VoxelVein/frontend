/**
 * Platform roles, ordered from least to most privileged.
 *
 * A role grants everything at or below its rank, so this is a strict ladder.
 * Every check goes through `hasRole` rather than comparing role names, so
 * adding a rank here extends the ladder without touching call sites.
 */
export const ROLE_RANK = {
  admin: 2,
  moderator: 1,
  user: 0,
} as const;

export type Role = keyof typeof ROLE_RANK;

/** The minimum rank a given operation needs. */
export type MinimumRole = keyof typeof ROLE_RANK;

/**
 * Every role, least to most privileged.
 *
 * Written out rather than derived from `ROLE_RANK` so the order is explicit
 * and no sort is needed: the target is ES2022, which has no `toSorted`, and
 * `sort` would have to copy-then-sort to avoid mutating.
 */
export const ALL_ROLES = [
  "user",
  "moderator",
  "admin",
] as const satisfies readonly Role[];

/** How each role is written in the UI. */
export const ROLE_LABELS = {
  admin: "Admin",
  moderator: "Moderator",
  user: "User",
} as const satisfies Record<Role, string>;

/**
 * Narrows a stored role string to a role the ladder knows.
 *
 * Accepts `null`/`undefined` because the value comes off a database column
 * that may be empty, and every caller wants the same answer: no.
 */
export const isRole = (value: string | null | undefined): value is Role =>
  value !== null && value !== undefined && value in ROLE_RANK;

/**
 * Whether a stored role string clears a minimum rank.
 *
 * An unrecognised role ranks lowest rather than throwing, so a role that was
 * never wired up fails closed: it grants nothing. `assertRolesInSync` turns
 * that silent failure into a startup error instead.
 */
export const hasRole = (
  role: string | null | undefined,
  minimum: MinimumRole
): boolean => {
  if (!role || !isRole(role)) {
    return false;
  }
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
};

export const isAdmin = (role: string | null | undefined): boolean =>
  hasRole(role, "admin");

export const isModerator = (role: string | null | undefined): boolean =>
  hasRole(role, "moderator");

/**
 * What a role may do, named by intent rather than by rank.
 *
 * Call sites ask `can(role, "manageUsers")` instead of hard-coding `"admin"`.
 * A role string at a check site says *who* is trusted but not *why*, and
 * spread across eighteen files the answer drifts; naming the job instead makes
 * each site self-documenting and puts every minimum in this one table.
 *
 * `satisfies` keeps the minimums honest at compile time — a minimum naming a
 * role the ladder does not have is a type error, not a grant to nobody that
 * reads as a permission bug at runtime.
 *
 * A moderator holds `reviewProjects` and `viewAdminPanel` and nothing else.
 * Account and session handling is admin-only, so a moderator cannot list,
 * ban, or delete an account — including an admin's.
 */
export const CAPABILITY_MINIMUM = {
  manageDeletions: "admin",
  manageNotifications: "admin",
  managePosts: "admin",
  manageProtectedProjects: "admin",
  manageSessions: "admin",
  manageStorage: "admin",
  manageUsers: "admin",
  // Split from `managePosts` because publishing makes a post public, which is a
  // different decision from writing one. Same minimum today, kept separate so
  // the day drafting is opened up, publishing does not follow by accident.
  publishPosts: "admin",
  reviewProjects: "moderator",
  viewAdminPanel: "moderator",
} as const satisfies Record<string, MinimumRole>;

export type Capability = keyof typeof CAPABILITY_MINIMUM;

/**
 * Every capability, in table order.
 *
 * Written out rather than derived from `Object.keys`, which returns `string[]`
 * and so would force an assertion on anyone iterating the table — including
 * the startup checks and the tests. Order matches `CAPABILITY_MINIMUM`.
 */
export const ALL_CAPABILITIES = [
  "manageDeletions",
  "manageNotifications",
  "managePosts",
  "manageProtectedProjects",
  "manageSessions",
  "manageStorage",
  "manageUsers",
  "publishPosts",
  "reviewProjects",
  "viewAdminPanel",
] as const satisfies readonly Capability[];

/** Whether a role holds a capability. */
export const can = (
  role: string | null | undefined,
  capability: Capability
): boolean => hasRole(role, CAPABILITY_MINIMUM[capability]);

/**
 * Whether a caller may act on an account holding `targetRole`.
 *
 * The rule is seniority, not identity: you may act on anyone you are at least
 * as senior as. An admin therefore reaches every account *including another
 * admin's* — two admins need to be able to clean up a compromised peer, and
 * only a handful of people hold the role — while a moderator can never touch
 * an admin.
 *
 * This is a **UI** predicate, not an authorization check: it decides which
 * buttons are inert, and it is always paired with `can(role, "manageUsers")`.
 * Do not use it to guard a server function. It compares ranks only, so it
 * cannot know whether the caller holds the capability, and it deliberately
 * permits admin-on-admin. The rank it enforces is the plugin's own — Better
 * Auth has no notion of outranking a target — so `admin → admin` has to be
 * allowed here or the panel would block a legitimate action the server permits.
 *
 * A target whose role is unrecognised outranks everyone, so it fails closed
 * here the same way `hasRole` does.
 */
export const canActOn = (
  callerRole: string | null | undefined,
  targetRole: string | null | undefined
): boolean =>
  isRole(targetRole) &&
  hasRole(callerRole, "moderator") &&
  hasRole(callerRole, targetRole);

/**
 * Fails at startup if the role ladder and Better Auth's role map disagree.
 *
 * Without this, a role added to one and not the other fails closed and looks
 * like a permission bug rather than a configuration mistake.
 */
export const assertRolesInSync = (configured: readonly string[]): void => {
  const missing = ALL_ROLES.filter((role) => !configured.includes(role));
  if (missing.length > 0) {
    throw new Error(
      `Role ladder defines ${missing.join(", ")}, but the auth plugin does not. Add ${
        missing.length === 1 ? "it" : "them"
      } to the roles passed to admin() in src/lib/auth.ts.`
    );
  }
};

/**
 * This module is deliberately free of server imports.
 *
 * Client components need `hasRole` to decide what to render, and importing the
 * session helpers here would pull `auth` and therefore the database into the
 * browser bundle. Session-based guards live in `role-guards.ts`.
 */
