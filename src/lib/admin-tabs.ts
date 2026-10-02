import { can } from "@/lib/roles";
import type { Capability } from "@/lib/roles";

/**
 * The admin panel's tabs and who may see each one.
 *
 * Extracted from `src/routes/admin.tsx` so the policy is testable on its own.
 * That matters because of a real crash: the panel used to index
 * `visibleTabs[0]` to pick a fallback tab, and a role with no visible tab made
 * that `undefined.value`. A moderator whose only tab is Reviews, or a session
 * that has not resolved yet and therefore reads as "user", both hit it.
 */

export const ADMIN_TABS = [
  { label: "Users", value: "users" },
  { label: "Sessions", value: "sessions" },
  { label: "Posts", value: "posts" },
  { label: "Storage", value: "storage" },
  { label: "Notifications", value: "notifications" },
  { label: "Deletions", value: "deletions" },
  { label: "Reviews", value: "reviews" },
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number]["value"];

/** The capability each tab needs. */
export const TAB_CAPABILITY = {
  deletions: "manageDeletions",
  notifications: "manageNotifications",
  posts: "managePosts",
  reviews: "reviewProjects",
  sessions: "manageSessions",
  storage: "manageStorage",
  users: "manageUsers",
} as const satisfies Record<AdminTab, Capability>;

export const canSeeTab = (tab: AdminTab, role: string): boolean =>
  can(role, TAB_CAPABILITY[tab]);

/** The tabs a role may see, in display order. */
export const visibleTabsFor = (role: string) =>
  ADMIN_TABS.filter((entry) => canSeeTab(entry.value, role));

/**
 * The tab to actually render.
 *
 * Prefers the one in the URL so a shared link lands where it was aimed, and
 * otherwise falls back to the first the role can see.
 *
 * Total by construction: with no visible tab at all — which is what a resolved
 * "user" role produces — it still returns a defined tab instead of throwing.
 * The panel renders a skeleton until the session resolves, so this is a
 * belt-and-braces guard rather than the primary defence.
 */
export const resolveAdminTab = (requested: string, role: string): AdminTab => {
  const visible = visibleTabsFor(role);

  if (visible.some((entry) => entry.value === requested)) {
    // SAFETY: the guard compares against `visible`, whose entries are typed
    // `AdminTab`, so a match proves `requested` is one too.
    return requested as AdminTab;
  }

  // SAFETY: `visible` is non-empty for every staff role, and `ADMIN_TABS` is a
  // non-empty tuple, so one of the two always yields a real tab. The fallback
  // exists only so an empty list cannot throw at the call site.
  return visible[0]?.value ?? ADMIN_TABS[0].value;
};
