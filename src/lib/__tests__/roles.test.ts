import { describe, expect, it } from "vitest";

import {
  ALL_ROLES,
  assertRolesInSync,
  can,
  canActOn,
  ALL_CAPABILITIES,
  CAPABILITY_MINIMUM,
  hasRole,
  isAdmin,
  isModerator,
  isRole,
  ROLE_LABELS,
  ROLE_RANK,
} from "@/lib/roles";
import type { Capability } from "@/lib/roles";

/**
 * The policy, in prose, so a reviewer can check it without reading the code.
 *
 * `CAPABILITY_MINIMUM` is the machine-readable source of truth and this mirrors
 * it — `it("matches the capability table")` below fails if the two drift. The
 * duplication is deliberate: a permissions change should be a thing you can
 * see is wrong, not a thing you have to reconstruct from a table of ranks.
 */
const EXPECTED = {
  admin: [
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
  ],
  moderator: ["reviewProjects", "viewAdminPanel"],
  user: [],
} as const satisfies Record<string, readonly Capability[]>;

/**
 * What a role actually holds, sorted, for comparison against `EXPECTED`.
 *
 * `ALL_CAPABILITIES` is already in table order, and `EXPECTED` is written in
 * the same order, so the arrays compare directly with no sorting — which also
 * avoids `toSorted`, unavailable at this file's ES2022 target.
 */
const held = (role: string): Capability[] =>
  ALL_CAPABILITIES.filter((capability) => can(role, capability));

describe(can, () => {
  it("lets an admin do everything", () => {
    expect(held("admin")).toStrictEqual(EXPECTED.admin);
  });

  it("restricts a moderator to reviewing projects", () => {
    // A moderator reviews submissions and nothing else. In particular they
    // hold no `manageUsers`, which is what stops them reaching an admin's
    // account at all.
    expect(held("moderator")).toStrictEqual(EXPECTED.moderator);
  });

  it("grants a user nothing", () => {
    expect(held("user")).toStrictEqual([]);
  });

  it("grants nothing to a role that does not exist", () => {
    // Fails closed, so a typo in a setRole call cannot widen access.
    expect(held("superadmin")).toStrictEqual([]);
    expect(can(null, "reviewProjects")).toBeFalsy();
    expect(can(undefined, "viewAdminPanel")).toBeFalsy();
  });

  it("matches the capability table the guards read", () => {
    // The prose above and `CAPABILITY_MINIMUM` must agree, or the docs are
    // describing a policy the code does not implement.
    for (const role of ALL_ROLES) {
      for (const capability of ALL_CAPABILITIES) {
        expect(can(role, capability), `${role}.${capability}`).toBe(
          CAPABILITY_MINIMUM[capability] === "admin"
            ? role === "admin"
            : role !== "user"
        );
      }
    }
  });
});

describe(hasRole, () => {
  it("grants a rank at or above the required one", () => {
    expect(hasRole("admin", "moderator")).toBeTruthy();
    expect(hasRole("moderator", "moderator")).toBeTruthy();
    expect(hasRole("user", "moderator")).toBeFalsy();
  });

  it("fails closed for a role that does not exist", () => {
    // A typo in a setRole call must grant nothing rather than everything.
    expect(hasRole("superadmin", "moderator")).toBeFalsy();
    expect(hasRole("", "user")).toBeFalsy();
    expect(hasRole("user,moderator", "moderator")).toBeFalsy();
  });

  it("treats a null or missing role as unprivileged", () => {
    expect(hasRole(null, "user")).toBeFalsy();
    expect(hasRole(undefined, "user")).toBeFalsy();
  });
});

describe("role ladder", () => {
  it("orders roles from least to most privileged", () => {
    expect(ROLE_RANK.user).toBeLessThan(ROLE_RANK.moderator);
    expect(ROLE_RANK.moderator).toBeLessThan(ROLE_RANK.admin);
  });

  it("lists every role for the admin UI", () => {
    expect(ALL_ROLES).toStrictEqual(["user", "moderator", "admin"]);
  });

  it("labels every role", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });
});

describe(isRole, () => {
  it("accepts ladder members and rejects anything else", () => {
    expect(isRole("moderator")).toBeTruthy();
    expect(isRole("owner")).toBeFalsy();
  });

  it("treats a missing role as not one", () => {
    // The value comes off a nullable database column, so an empty one has to
    // fail closed rather than throw. An *absent* role is covered by the
    // `can(undefined, ...)` and `canActOn(undefined, ...)` cases above, which
    // pass one through the same predicate.
    expect(isRole(null)).toBeFalsy();
    expect(isRole("")).toBeFalsy();
  });
});

describe(canActOn, () => {
  it("lets an admin act on a user or another admin", () => {
    // Equal rank is allowed on purpose: only a handful of people hold admin,
    // and two admins need to be able to clean up a compromised peer.
    expect(canActOn("admin", "user")).toBeTruthy();
    expect(canActOn("admin", "moderator")).toBeTruthy();
    expect(canActOn("admin", "admin")).toBeTruthy();
  });

  it("stops a moderator acting on an admin", () => {
    expect(canActOn("moderator", "user")).toBeTruthy();
    expect(canActOn("moderator", "moderator")).toBeTruthy();
    expect(canActOn("moderator", "admin")).toBeFalsy();
  });

  it("stops a plain user acting on anyone, including another user", () => {
    // The bare seniority test would pass here, since both are rank 0. A user
    // reaching a manage-accounts control at all is the bug this prevents.
    for (const target of ALL_ROLES) {
      expect(canActOn("user", target)).toBeFalsy();
    }
    expect(canActOn(null, "user")).toBeFalsy();
  });

  it("treats an unrecognised target role as outranking everyone", () => {
    // Fails closed, matching hasRole: a role wired into the database but not
    // the ladder must not become something an admin can casually act on.
    expect(canActOn("admin", "superuser")).toBeFalsy();
    expect(canActOn("admin", null)).toBeFalsy();
  });

  it("grants nothing to a caller with no role", () => {
    expect(canActOn(null, "user")).toBeFalsy();
    expect(canActOn(undefined, "user")).toBeFalsy();
  });
});

describe(isAdmin, () => {
  it("is true only for admins", () => {
    expect(isAdmin("admin")).toBeTruthy();
    expect(isAdmin("moderator")).toBeFalsy();
    expect(isAdmin("user")).toBeFalsy();
  });
});

describe(isModerator, () => {
  it("includes admins, since the ladder is cumulative", () => {
    expect(isModerator("admin")).toBeTruthy();
    expect(isModerator("moderator")).toBeTruthy();
    expect(isModerator("user")).toBeFalsy();
  });
});

describe(assertRolesInSync, () => {
  it("passes when every ladder role is configured", () => {
    expect(() => assertRolesInSync(ALL_ROLES)).not.toThrow();
  });

  it("throws when the plugin is missing a role", () => {
    // Without this, a role wired into only one of the two places fails closed
    // and reads as a permission bug rather than a configuration mistake.
    expect(() => assertRolesInSync(["user", "admin"])).toThrow(/moderator/u);
  });
});
