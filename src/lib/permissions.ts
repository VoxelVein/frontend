import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

import {
  ALL_CAPABILITIES,
  ALL_ROLES,
  assertRolesInSync,
  can,
  CAPABILITY_MINIMUM,
} from "@/lib/roles";
import type { Capability, Role } from "@/lib/roles";

/**
 * Better Auth's access control, extended with the statements this app gates.
 *
 * `mod` and `report` used to be declared here. Nothing read them: no `/admin/*`
 * endpoint in the plugin names either resource, and no `hasPermission` call
 * exists outside this file. They were documentation that looked like
 * enforcement. Both are now enforced where they actually run — as
 * `requireCapability` guards in server functions — so they are gone from here
 * rather than left to imply a boundary that was never there.
 */
export const ac = createAccessControl({
  ...defaultStatements,
});

const USER_STATEMENTS = [
  "ban",
  "create",
  "delete",
  "get",
  "list",
  "set-email",
  "set-password",
  "set-role",
  "update",
] as const;

const SESSION_STATEMENTS = ["delete", "list", "revoke"] as const;

/**
 * The Better Auth resource each statement-bearing capability gates.
 *
 * A capability missing from this map has no `/admin/*` endpoint behind it, and
 * is enforced in app code by `requireCapability` instead. `statementsFor`
 * throws if one is ever given statements anyway, because a capability that
 * looks plugin-enforced but is not is the exact drift this file guards.
 */
const CAPABILITY_RESOURCE: Readonly<Partial<Record<Capability, string>>> = {
  manageSessions: "session",
  manageUsers: "user",
};

/**
 * The statements each role holds, grouped by the capability that grants them.
 *
 * Held as data and handed to `newRole` below rather than written inline,
 * because `newRole` returns an opaque object: statements passed straight to it
 * cannot be read back, so an inline table could not be checked against the
 * ladder. This way the table that *grants* is the table that is *verified*.
 *
 * Adding a statement means naming the capability that covers it, and naming
 * the capability means holding it — see `assertCapabilitiesAgree`.
 */
const ROLE_STATEMENTS: Record<
  Role,
  Partial<Record<Capability, readonly string[]>>
> = {
  admin: { manageSessions: SESSION_STATEMENTS, manageUsers: USER_STATEMENTS },
  moderator: {},
  user: {},
};

/**
 * Groups a role's statements by the resource Better Auth routes them with.
 *
 * `StatementTable` is the shape `ac.newRole` accepts; the return type is left
 * to inference so a resource missing from `CAPABILITY_RESOURCE` is a throw
 * below rather than a widened index signature that would type-check.
 */
const statementsFor = (role: Role) => {
  const grouped: Record<string, readonly string[]> = {};

  for (const capability of ALL_CAPABILITIES) {
    const statements = ROLE_STATEMENTS[role][capability];
    if (!statements) {
      continue;
    }
    const resource = CAPABILITY_RESOURCE[capability];
    if (!resource) {
      throw new Error(
        `${capability} is granted ${role} statements, but it maps to no Better ` +
          `resource in CAPABILITY_RESOURCE. Add it there if the plugin has an ` +
          `endpoint for it, or drop the statements — otherwise the grant looks ` +
          `enforced by the plugin but is enforced by nothing.`
      );
    }
    grouped[resource] = [...(grouped[resource] ?? []), ...statements];
  }

  return grouped;
};

/**
 * Fails startup if a role holds statements for a capability it does not have.
 *
 * `CAPABILITY_MINIMUM` and these statements are two independent expressions of
 * the same policy, and a drift between them fails **open**, not closed. The
 * admin panel is explicitly not the security boundary — it hides tabs — so a
 * stray `user: ["ban"]` on `moderator` would hand back a power no UI shows,
 * and nothing else would notice. This is the check that makes the capability
 * table worth having.
 */
const assertCapabilitiesAgree = (): void => {
  for (const role of ALL_ROLES) {
    for (const capability of ALL_CAPABILITIES) {
      const offending =
        ROLE_STATEMENTS[role][capability] !== undefined &&
        !can(role, capability);
      if (offending) {
        // Falls back to the capability name only so the message reads when a
        // capability has no resource mapped at all.
        const resource = CAPABILITY_RESOURCE[capability] ?? capability;
        throw new Error(
          `Role "${role}" holds ${resource} statements, but ${capability} ` +
            `requires ${CAPABILITY_MINIMUM[capability]}. Better Auth gates ` +
            `/admin/* from these statements alone, so this grants a power the ` +
            `admin panel does not show. Either raise the capability's minimum or ` +
            `drop the statements.`
        );
      }
    }
  }
};

export const moderator = ac.newRole(statementsFor("moderator"));
export const admin = ac.newRole(statementsFor("admin"));
export const user = ac.newRole(statementsFor("user"));

/** Every role passed to the admin plugin, in ladder order. */
export const staffRoles = {
  admin,
  moderator,
  user,
} as const;

// A role in the ladder that the plugin does not know about would fail closed
// and read as a permission bug, so surface it at startup instead.
assertRolesInSync(Object.keys(staffRoles));
assertCapabilitiesAgree();
