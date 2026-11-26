import {
  IconArrowsExchange,
  IconBell,
  IconClipboardCheck,
  IconDatabase,
  IconDevices,
  IconFileText,
  IconFlag,
  IconLifebuoy,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import { AppSidebar, AppSidebarDrawer } from "@/components/app-sidebar";
import type { SidebarSection } from "@/components/app-sidebar";
import type { AdminTab } from "@/lib/admin-tabs";

/** Badge counts fetched by the panel; each may be stale at zero. */
export interface AdminTabCounts {
  open: number;
  pending: number;
  unread: number;
}

interface AdminTabEntry {
  label: string;
  value: AdminTab;
}

interface AdminSidebarProps {
  activeTab: AdminTab;
  counts: AdminTabCounts;
  onSelectTab: (tab: AdminTab) => void;
  tabs: readonly AdminTabEntry[];
}

/**
 * Sections, grouped by what an admin is doing rather than by the order they
 * were built in. A group with no visible tab is omitted, so the navigation
 * keeps reflecting `visibleTabsFor(role)` exactly.
 */
const NAV_GROUPS = [
  { label: "People", tabs: ["users", "sessions", "deletions"] },
  { label: "Content", tabs: ["posts", "storage", "transfers"] },
  { label: "Moderation", tabs: ["notifications", "reviews", "reports"] },
  { label: "Support", tabs: ["tickets"] },
] as const satisfies readonly {
  label: string;
  tabs: readonly AdminTab[];
}[];

const TAB_ICONS: Record<AdminTab, ReactNode> = {
  deletions: <IconTrash size={18} aria-hidden="true" />,
  notifications: <IconBell size={18} aria-hidden="true" />,
  posts: <IconFileText size={18} aria-hidden="true" />,
  reports: <IconFlag size={18} aria-hidden="true" />,
  reviews: <IconClipboardCheck size={18} aria-hidden="true" />,
  sessions: <IconDevices size={18} aria-hidden="true" />,
  storage: <IconDatabase size={18} aria-hidden="true" />,
  tickets: <IconLifebuoy size={18} aria-hidden="true" />,
  transfers: <IconArrowsExchange size={18} aria-hidden="true" />,
  users: <IconUsers size={18} aria-hidden="true" />,
};

const countForTab = (tab: AdminTab, counts: AdminTabCounts) => {
  if (tab === "notifications") {
    return { count: counts.unread, suffix: "unread" };
  }

  if (tab === "reviews") {
    return { count: counts.pending, suffix: "pending" };
  }

  if (tab === "reports") {
    return { count: counts.open, suffix: "open" };
  }

  return { count: 0, suffix: "" };
};

/**
 * Turn the admin's visible tabs into sidebar sections, keeping the grouping
 * and dropping groups whose entries are all hidden.
 */
const resolveAdminSections = (
  tabs: readonly AdminTabEntry[],
  counts: AdminTabCounts
): readonly SidebarSection<AdminTab>[] =>
  NAV_GROUPS.flatMap((group) => {
    // One pass over the group's tabs: an entry that is not in `tabs` is hidden,
    // so there is no reason to filter and then map it back to its label.
    const entries = group.tabs.flatMap((tab) => {
      const entry = tabs.find((candidate) => candidate.value === tab);

      if (!entry) {
        return [];
      }

      const { count, suffix } = countForTab(tab, counts);

      return [
        {
          count,
          suffix,
          icon: TAB_ICONS[tab],
          label: entry.label ?? tab,
          value: tab,
        },
      ];
    });

    return entries.length > 0 ? [{ entries, heading: group.label }] : [];
  });

export const AdminSidebar = (props: AdminSidebarProps) => {
  const sections = resolveAdminSections(props.tabs, props.counts);

  return (
    <AppSidebar<AdminTab>
      activeValue={props.activeTab}
      collapseAriaLabel="Collapse admin navigation"
      expandAriaLabel="Expand admin navigation"
      navLabel="Admin sections"
      onSelect={props.onSelectTab}
      sections={sections}
      title="Admin panel"
      subtitle="Choose a section"
    />
  );
};

/** The same navigation in a drawer, for screens below the sidebar breakpoint. */
export const AdminMobileNav = (props: AdminSidebarProps) => (
  <AppSidebarDrawer<AdminTab>
    activeValue={props.activeTab}
    navLabel="Admin sections"
    onSelect={props.onSelectTab}
    sections={resolveAdminSections(props.tabs, props.counts)}
    sheetTitle="Admin sections"
    sheetDescription="Switch between the parts of the admin panel you can manage."
    triggerLabel="Sections"
  />
);
