import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

import { assertRolesInSync } from "@/lib/roles";

export const ac = createAccessControl({
  ...defaultStatements,
  mod: ["create", "update", "delete"],
  report: ["review", "dismiss"],
});

/**
 * Staff roles, ordered least to most privileged.
 *
 * `moderator` reviews projects and drafts blog posts. It can disable an
 * account, which `ban` allows, but deliberately cannot delete users, change
 * roles, revoke sessions, or publish a post. Those statements are absent, so
 * Better Auth refuses the matching `/admin/*` endpoints even if a guard in
 * this app is ever missed. That is the reason the split is expressed here as
 * well as in `ROLE_RANK`.
 */
export const moderator = ac.newRole({
  mod: ["update"],
  report: ["review", "dismiss"],
  // Read the user list and ban, nothing that removes or re-ranks an account.
  user: ["get", "list", "ban"],
});

export const admin = ac.newRole({
  mod: ["create", "update", "delete"],
  report: ["review", "dismiss"],
  session: ["list", "revoke", "delete"],
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "delete",
    "set-password",
    "set-email",
    "get",
    "update",
  ],
});

export const user = ac.newRole({
  mod: [],
  report: [],
  session: [],
  user: [],
});

/** Every role passed to the admin plugin, in ladder order. */
export const staffRoles = {
  admin,
  moderator,
  user,
} as const;

// A role in the ladder that the plugin does not know about would fail closed
// and read as a permission bug, so surface it at startup instead.
assertRolesInSync(Object.keys(staffRoles));
