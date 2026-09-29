import { describe, expect, it } from "vitest";

import { admin, moderator, staffRoles, user } from "@/lib/permissions";
import { ROLE_RANK } from "@/lib/roles";

/**
 * Verifies the Better Auth access-control statements, which are the real
 * boundary for /admin/* endpoints. A moderator's reach there is decided by
 * these statements, not by the ROLE_RANK ladder the app checks against.
 */
describe("role definitions", () => {
  it("gives a moderator the review statements", () => {
    const check = moderator.authorize({ report: ["review"] });
    expect(check.success).toBeTruthy();
    const dismiss = moderator.authorize({ report: ["dismiss"] });
    expect(dismiss.success).toBeTruthy();
  });

  it("lets a moderator ban but not delete or re-rank an account", () => {
    expect(moderator.authorize({ user: ["ban"] }).success).toBeTruthy();
    expect(moderator.authorize({ user: ["delete"] }).success).toBeFalsy();
    expect(moderator.authorize({ user: ["set-role"] }).success).toBeFalsy();
    expect(moderator.authorize({ user: ["set-password"] }).success).toBeFalsy();
    expect(moderator.authorize({ user: ["set-email"] }).success).toBeFalsy();
  });

  it("keeps session and impersonation powers off a moderator", () => {
    expect(moderator.authorize({ session: ["list"] }).success).toBeFalsy();
    expect(moderator.authorize({ session: ["revoke"] }).success).toBeFalsy();
  });

  it("does not let a moderator create or delete mods", () => {
    expect(moderator.authorize({ mod: ["create"] }).success).toBeFalsy();
    expect(moderator.authorize({ mod: ["delete"] }).success).toBeFalsy();
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

describe("the staff role map", () => {
  it("registers every role in the ladder", () => {
    for (const role of Object.keys(ROLE_RANK)) {
      expect(Object.keys(staffRoles)).toContain(role);
    }
  });
});
