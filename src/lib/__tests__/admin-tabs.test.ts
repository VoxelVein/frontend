import { describe, expect, it } from "vitest";

import { ADMIN_TABS, resolveAdminTab, visibleTabsFor } from "@/lib/admin-tabs";

/**
 * The panel used to pick a fallback tab with `visibleTabs[0].value`, which
 * threw `can't access property "value", visibleTabs[0] is undefined` and took
 * the whole admin page down. Any role with no visible tab reaches it.
 */
describe(resolveAdminTab, () => {
  it("keeps the requested tab when the role can see it", () => {
    expect(resolveAdminTab("storage", "admin")).toBe("storage");
    expect(resolveAdminTab("reviews", "moderator")).toBe("reviews");
  });

  it("falls back to the first tab the role can see", () => {
    // A moderator bookmarked a link to an admin-only tab.
    expect(resolveAdminTab("users", "moderator")).toBe("reviews");
  });

  it("returns a defined tab for a role that can see none", () => {
    // The crash. `role` is "user" until `useSession` resolves, and "user" sees
    // nothing, so this is the state the panel hit on first paint.
    expect(visibleTabsFor("user")).toStrictEqual([]);
    // What matters is that it names a real tab, not that it is truthy.
    const values = ADMIN_TABS.map((tab) => tab.value);
    expect(values).toContain(resolveAdminTab("users", "user"));
  });

  it("never returns a tab outside the panel", () => {
    const values = ADMIN_TABS.map((tab) => tab.value);
    for (const role of ["user", "moderator", "admin"]) {
      for (const requested of [...values, "nonsense"]) {
        expect(values).toContain(resolveAdminTab(requested, role));
      }
    }
  });

  it("gives an admin everything and a moderator only the moderation queues", () => {
    expect(visibleTabsFor("admin")).toHaveLength(ADMIN_TABS.length);
    // Reviews and Reports are the two a moderator holds; nothing else.
    expect(visibleTabsFor("moderator").map((t) => t.value)).toStrictEqual([
      "reviews",
      "reports",
    ]);
  });
});
