import {
  IconBell,
  IconClipboardCheck,
  IconDatabase,
  IconDevices,
  IconFileText,
  IconFlag,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightExpand,
  IconLifebuoy,
  IconMenu2,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AdminTab } from "@/lib/admin-tabs";
import { cn } from "@/lib/utils";

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
  { label: "Content", tabs: ["posts", "storage"] },
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

const NavItem = ({
  active,
  collapsed,
  count,
  label,
  onSelect,
  suffix,
  tab,
}: {
  active: boolean;
  collapsed: boolean;
  count: number;
  label: string;
  onSelect: (tab: AdminTab) => void;
  suffix: string;
  tab: AdminTab;
}) => {
  const countLabel = count > 0 ? `, ${count} ${suffix}` : "";

  const button = (
    <Button
      type="button"
      variant="ghost"
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? `${label}${countLabel}` : undefined}
      onClick={() => onSelect(tab)}
      className={cn(
        "focus-visible:ring-ring relative h-10 w-full gap-2.5 rounded-lg px-2.5 text-sm font-medium",
        collapsed ? "justify-center px-0" : "justify-start",
        active
          ? "bg-primary/10 text-primary hover:bg-primary/15"
          : "text-muted-foreground hover:text-foreground font-normal"
      )}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        {TAB_ICONS[tab]}
      </span>
      {collapsed ? null : (
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      )}
      {count > 0 ? (
        <Badge
          variant={active ? "default" : "secondary"}
          className={cn(
            "h-5 min-w-5 justify-center px-1.5 tabular-nums",
            collapsed &&
              "absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[0.65rem]"
          )}
        >
          {count}
          <span className="sr-only"> {suffix}</span>
        </Badge>
      ) : null}
    </Button>
  );

  if (!collapsed) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="right">
        {label}
        {countLabel}
      </TooltipContent>
    </Tooltip>
  );
};

const NavList = ({
  activeTab,
  collapsed,
  counts,
  onSelectTab,
  tabs,
}: AdminSidebarProps & { collapsed: boolean }) => {
  const visibleValues = new Set(tabs.map((entry) => entry.value));
  const labelFor = (tab: AdminTab) =>
    tabs.find((entry) => entry.value === tab)?.label ?? tab;
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs.filter((tab) => visibleValues.has(tab)),
  })).filter((group) => group.tabs.length > 0);

  return (
    <nav aria-label="Admin sections" className="grid gap-5">
      {groups.map((group) => {
        const headingId = `admin-nav-${group.label.toLowerCase()}`;

        return (
          <section
            key={group.label}
            aria-labelledby={headingId}
            className="grid gap-1"
          >
            <p
              id={headingId}
              className={cn(
                "text-muted-foreground text-[0.7rem] font-semibold tracking-wide uppercase",
                collapsed ? "sr-only" : "px-2.5 pb-1"
              )}
            >
              {group.label}
            </p>

            {group.tabs.map((tab) => {
              const { count, suffix } = countForTab(tab, counts);

              return (
                <NavItem
                  key={tab}
                  active={activeTab === tab}
                  collapsed={collapsed}
                  count={count}
                  label={labelFor(tab)}
                  onSelect={onSelectTab}
                  suffix={suffix}
                  tab={tab}
                />
              );
            })}
          </section>
        );
      })}
    </nav>
  );
};

/**
 * The admin panel's persistent navigation.
 *
 * The tab bar it replaces wrapped on narrow screens until every entry was a
 * two-line chip. This keeps the same destinations and permissions  -  entries
 * still come from `visibleTabsFor`  -  but gives each one a fixed row, an icon,
 * and a group heading, so the list stays scannable as more admin tools arrive.
 */
export const AdminSidebar = (props: AdminSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden shrink-0 transition-[width] duration-200 motion-reduce:transition-none lg:block",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div
        className={cn(
          "border-border bg-card sticky top-20 grid gap-4 rounded-2xl border p-3",
          collapsed && "p-2"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2",
            collapsed && "flex-col gap-1"
          )}
        >
          {collapsed ? null : (
            <div className="min-w-0 flex-1 px-1">
              <p className="text-foreground text-sm font-semibold">
                Admin panel
              </p>
              <p className="text-muted-foreground text-xs">Choose a section</p>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size={collapsed ? "icon" : "icon-sm"}
            aria-expanded={!collapsed}
            aria-label={
              collapsed
                ? "Expand admin navigation"
                : "Collapse admin navigation"
            }
            onClick={() => setCollapsed((current) => !current)}
            className="text-muted-foreground shrink-0"
          >
            {collapsed ? (
              <IconLayoutSidebarRightExpand aria-hidden="true" />
            ) : (
              <IconLayoutSidebarLeftCollapse aria-hidden="true" />
            )}
          </Button>
        </div>

        <NavList {...props} collapsed={collapsed} />
      </div>
    </aside>
  );
};

/** The same navigation in a drawer, for screens below the sidebar breakpoint. */
export const AdminMobileNav = (props: AdminSidebarProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="outline" className="min-h-11 lg:hidden" />}
      >
        <IconMenu2 aria-hidden="true" />
        Sections
      </SheetTrigger>

      <SheetContent side="left" className="w-[min(20rem,85vw)]">
        <SheetHeader>
          <SheetTitle>Admin sections</SheetTitle>
          <SheetDescription>
            Switch between the parts of the admin panel you can manage.
          </SheetDescription>
        </SheetHeader>

        <div className="overflow-y-auto px-3 pb-4">
          <NavList
            {...props}
            collapsed={false}
            onSelectTab={(tab) => {
              props.onSelectTab(tab);
              setOpen(false);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
