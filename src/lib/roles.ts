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

export const isRole = (value: string): value is Role => value in ROLE_RANK;

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

/** The minimum rank a role must hold to reach the admin panel. */
export const ADMIN_PANEL_ROLE = "moderator";

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
