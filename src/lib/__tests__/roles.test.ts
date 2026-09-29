import { describe, expect, it } from "vitest";

import {
  ALL_ROLES,
  assertRolesInSync,
  hasRole,
  isAdmin,
  isModerator,
  isRole,
  ROLE_LABELS,
  ROLE_RANK,
} from "@/lib/roles";

/**
 * The capability matrix, stated once.
 *
 * Every other test derives from this table, so a role change is a one-line
 * edit here and a failing assertion everywhere it matters.
 */
const CAPABILITIES = {
  "delete users": "admin",
  "disable an account": "moderator",
  "draft a blog post": "moderator",
  "publish a blog post": "admin",
  "read draft projects": "moderator",
  "remove a project": "admin",
  "restore a scheduled deletion": "admin",
  "revoke sessions": "admin",
  "set a role": "admin",
  "view site storage": "admin",
} as const satisfies Record<string, keyof typeof ROLE_RANK>;

type Capability = keyof typeof CAPABILITIES;

// SAFETY: Object.keys returns this object's own enumerable string keys, which
// for CAPABILITIES are exactly the Capability union.
const ALL_CAPABILITIES = Object.keys(CAPABILITIES) as Capability[];

const grants = (role: string, capability: Capability) =>
  hasRole(role, CAPABILITIES[capability]);

describe(hasRole, () => {
  it("grants a capability at or above the required rank", () => {
    expect(grants("admin", "publish a blog post")).toBeTruthy();
    expect(grants("moderator", "draft a blog post")).toBeTruthy();
    expect(grants("user", "read draft projects")).toBeFalsy();
  });

  it("keeps a moderator below every admin-only capability", () => {
    const wronglyGranted = ALL_CAPABILITIES.filter(
      (capability) =>
        CAPABILITIES[capability] === "admin" && grants("moderator", capability)
    );
    expect(wronglyGranted).toStrictEqual([]);
  });

  it("lets an admin do everything", () => {
    for (const capability of ALL_CAPABILITIES) {
      expect(grants("admin", capability)).toBeTruthy();
    }
  });

  it("grants a user nothing", () => {
    for (const capability of ALL_CAPABILITIES) {
      expect(grants("user", capability)).toBeFalsy();
    }
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
