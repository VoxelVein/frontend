import { describe, expect, it } from "vitest";

import { admin, moderator, staffRoles, user } from "@/lib/permissions";
import { ALL_CAPABILITIES, ALL_ROLES, can, ROLE_RANK } from "@/lib/roles";
import type { Capability, Role } from "@/lib/roles";

/**
 * Verifies the Better Auth access-control statements, which are the real
 * boundary for /admin/* endpoints. A moderator's reach there is decided by
 * these statements, not by the ROLE_RANK ladder the app checks against.
 *
 * `mod` and `report` are gone: no /admin/* endpoint in the plugin names either
 * resource, and the policy they described now lives in `CAPABILITY_MINIMUM` and
 * is enforced by `requireCapability`. The `it("no custom statements")` case
 * below is what stops them creeping back in as decoration.
 */
describe("role definitions", () => {
  it("declares no statements beyond the plugin's own user and session", () => {
    // A statement here with no endpoint behind it is a promise nothing keeps,
    // which is how `mod` and `report` came to look like enforcement.
    const resources = new Set(
      Object.values(staffRoles).flatMap((role) => Object.keys(role.statements))
    );
    // Membership rather than a sorted comparison: `toSorted` is unavailable at
    // this file's ES2022 target and the order is not what is under test.
    expect(resources.has("user")).toBeTruthy();
    expect(resources.has("session")).toBeTruthy();
    expect(resources.size).toBe(2);
  });

  it("grants a moderator no user or session statement at all", () => {
    // This is what makes a moderator unable to ban anyone, including an admin.
    // Asserting the negative per-statement would pass even if a new statement
    // were added later, so the whole set is checked instead.
    const granted = Object.entries(moderator.statements).flatMap(
      ([statement, actions]) =>
        actions.map((action) => `${statement}:${action}`)
    );
    expect(granted).toStrictEqual([]);
  });

  it("refuses every /admin endpoint a moderator might reach", () => {
    for (const action of [
      "get",
      "list",
      "ban",
      "delete",
      "set-role",
    ] as const) {
      expect(moderator.authorize({ user: [action] }).success).toBeFalsy();
    }
    expect(moderator.authorize({ session: ["list"] }).success).toBeFalsy();
    expect(moderator.authorize({ session: ["revoke"] }).success).toBeFalsy();
  });

  it("keeps impersonation off a moderator", () => {
    expect(moderator.authorize({ user: ["impersonate"] }).success).toBeFalsy();
    expect(
      moderator.authorize({ user: ["impersonate-admins"] }).success
    ).toBeFalsy();
  });

  it("gives an admin the full user and session sets", () => {
    for (const action of [
      "get",
      "list",
      "ban",
      "delete",
      "set-role",
      "set-password",
      "set-email",
    ] as const) {
      expect(admin.authorize({ user: [action] }).success).toBeTruthy();
    }
    for (const action of ["list", "revoke", "delete"] as const) {
      expect(admin.authorize({ session: [action] }).success).toBeTruthy();
    }
  });

  it("lets an admin do every statement the moderator can", () => {
    // The ladder is cumulative, so an admin must never be weaker than a
    // moderator on any statement both declare.
    const adminChecks = Object.entries(moderator.statements).map(
      ([statement, actions]) =>
        actions.map(
          (action) => admin.authorize({ [statement]: [action] }).success
        )
    );
    expect(adminChecks.flat().every(Boolean)).toBeTruthy();
  });

  it("grants a user nothing", () => {
    const granted = Object.entries(user.statements).flatMap(
      ([statement, actions]) =>
        actions.map((action) => `${statement}:${action}`)
    );
    expect(granted).toStrictEqual([]);
  });
});

describe("capability statements", () => {
  /**
   * The check `permissions.ts` runs at import, restated here so a failure names
   * the capability instead of surfacing as a startup crash.
   *
   * Worth pinning because the drift fails **open**: the admin panel only hides
   * what a role cannot do, so a stray statement would hand back a power no UI
   * shows and nothing downstream would notice.
   *
   * Better Auth groups statements by *resource*, so the resource names are
   * mapped back to the capabilities that claim them.
   */
  const CAPABILITIES_BY_RESOURCE = {
    session: ["manageSessions"],
    user: ["manageUsers"],
  } as const satisfies Record<string, readonly Capability[]>;

  type Resource = keyof typeof CAPABILITIES_BY_RESOURCE;

  /**
   * The capabilities that claim a resource, or throw if nothing does.
   *
   * A resource granted with no capability behind it is a statement nothing
   * checks, which is the failure this indirection exists to make explicit.
   */
  const claimsFor = (resource: string): readonly Capability[] => {
    // SAFETY: `resource` comes from `Object.keys` over a role's `statements`,
    // which the case above proves only ever holds `user` or `session` — the
    // exact key list of `CAPABILITIES_BY_RESOURCE`.
    const claims = CAPABILITIES_BY_RESOURCE[resource as Resource];
    if (!claims) {
      throw new Error(
        `${resource} has statements but no capability claims it. Add it to ` +
          `CAPABILITIES_BY_RESOURCE or drop the statements.`
      );
    }
    return claims;
  };

  it("never grants a role a statement its capability minimum excludes", () => {
    for (const role of ALL_ROLES) {
      for (const [resource, actions] of Object.entries(
        staffRoles[role].statements
      )) {
        // The action names do not matter here — only which resource was
        // granted — so the count is what gets asserted, not the strings.
        expect(actions.length).toBeGreaterThan(0);
        for (const capability of claimsFor(resource)) {
          expect(
            can(role, capability),
            `${role} -> ${capability}`
          ).toBeTruthy();
        }
      }
    }
  });

  it("gives exactly the capabilities named for each role", () => {
    // Restating the policy in the direction a reader cares about: which role
    // can do what. A change to the ladder shows up here as a named failure.
    //
    // Typed as a `Role` record so iteration is over `ALL_ROLES` and yields a
    // real `Role`, rather than asserting a key list back into one.
    const expected = {
      admin: [
        "manageDeletions",
        "manageNotifications",
        "managePosts",
        "manageProtectedProjects",
        "manageReports",
        "manageSessions",
        "manageStorage",
        "manageUsers",
        "publishPosts",
        "reviewProjects",
        "viewAdminPanel",
      ],
      moderator: ["manageReports", "reviewProjects", "viewAdminPanel"],
      user: [],
    } satisfies Record<Role, readonly Capability[]>;

    for (const role of ALL_ROLES) {
      const held: ReadonlySet<Capability> = new Set(expected[role]);
      for (const capability of ALL_CAPABILITIES) {
        expect(can(role, capability), `${role}.${capability}`).toBe(
          held.has(capability)
        );
      }
    }
  });
});

describe("the staff role map", () => {
  it("registers every role in the ladder", () => {
    for (const role of Object.keys(ROLE_RANK)) {
      expect(Object.keys(staffRoles)).toContain(role);
    }
  });
});
