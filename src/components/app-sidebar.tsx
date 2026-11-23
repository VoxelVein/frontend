import {
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightExpand,
  IconMenu2,
} from "@tabler/icons-react";
import { useId, useState } from "react";
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
import { cn } from "@/lib/utils";

/**
 * One row of a sidebar navigation.
 *
 * `value` is both the stable identity of the row and the value handed back by
 * `onSelect`, so callers never round-trip through display strings. `label` is
 * the accessible name in all states, collapsed or not.
 */
export interface SidebarEntry<T extends string = string> {
  /** Stable identity of the entry; also the value reported on selection. */
  value: T;
  /** Visible label; doubles as the accessible name. */
  label: string;
  /** Optional icon rendered ahead of the label. */
  icon?: ReactNode;
  /** Badge count; omitted when there is nothing to count. */
  count?: number;
  /** Badge suffix such as "pending"; only read when `count` is set. */
  suffix?: string;
}

/**
 * A named group of sidebar rows.
 *
 * Groups are the caller's decision - the admin panel groups by what an admin
 * is doing, the settings sidebar by area of the account - and entries whose
 * group has no visible member are filtered out before they reach the sidebar.
 */
export interface SidebarSection<T extends string = string> {
  /** Group heading; omitted for flat lists that need no grouping. */
  heading?: string;
  entries: readonly SidebarEntry<T>[];
}

export interface SidebarNavProps<T extends string = string> {
  /** The section the visitor is currently on. */
  activeValue: T;
  /** Accessible label for the rendered navigation landmark. */
  navLabel?: string;
  /** Called with the value of the entry that was chosen. */
  onSelect: (value: T) => void;
  /** The sections to render, in display order. */
  sections: readonly SidebarSection<T>[];
}

interface AppSidebarProps<
  T extends string = string,
> extends SidebarNavProps<T> {
  /** Accessible name of the button that collapses the sidebar. */
  collapseAriaLabel: string;
  /** Accessible name of the button that expands the sidebar. */
  expandAriaLabel: string;
  /** Panel heading, shown while the sidebar is expanded. */
  title?: string;
  /** Supporting copy under {@link AppSidebarProps.title}. */
  subtitle?: string;
}

interface NavItemProps<T extends string> {
  active: boolean;
  collapsed: boolean;
  count?: number;
  icon?: ReactNode;
  label: string;
  onSelect: (value: T) => void;
  suffix?: string;
  value: T;
}

const NavItem = <T extends string>({
  active,
  collapsed,
  count,
  icon,
  label,
  onSelect,
  suffix,
  value,
}: NavItemProps<T>) => {
  const countLabel = count && count > 0 ? `, ${count} ${suffix}` : "";

  const button = (
    <Button
      type="button"
      variant="ghost"
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? `${label}${countLabel}` : undefined}
      onClick={() => onSelect(value)}
      className={cn(
        "focus-visible:ring-ring relative h-10 w-full gap-2.5 rounded-lg px-2.5 text-sm font-medium",
        collapsed ? "justify-center px-0" : "justify-start",
        active
          ? "bg-primary/10 text-primary hover:bg-primary/15"
          : "text-muted-foreground hover:text-foreground font-normal"
      )}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        {icon}
      </span>
      {collapsed ? null : (
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      )}
      {count && count > 0 ? (
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

interface NavListProps<T extends string> extends SidebarNavProps<T> {
  collapsed: boolean;
}

const NavList = <T extends string>({
  activeValue,
  collapsed,
  navLabel,
  onSelect,
  sections,
}: NavListProps<T>) => {
  const headingId = useId();

  return (
    <nav aria-label={navLabel ?? "Sections"} className="grid gap-5">
      {sections.map((section, sectionIndex) => {
        const { heading } = section;
        const sectionId = `${headingId}-${sectionIndex}`;

        return (
          <section
            key={heading ?? sectionIndex}
            aria-labelledby={heading ? `${sectionId}-heading` : undefined}
            className="grid gap-1"
          >
            {heading ? (
              <p
                id={`${sectionId}-heading`}
                className={cn(
                  "text-muted-foreground text-[0.7rem] font-semibold tracking-wide uppercase",
                  collapsed ? "sr-only" : "px-2.5 pb-1"
                )}
              >
                {heading}
              </p>
            ) : null}

            {section.entries.map((entry) => (
              <NavItem
                key={entry.value}
                active={activeValue === entry.value}
                collapsed={collapsed}
                count={entry.count}
                icon={entry.icon}
                label={entry.label}
                onSelect={onSelect}
                suffix={entry.suffix}
                value={entry.value}
              />
            ))}
          </section>
        );
      })}
    </nav>
  );
};

/**
 * The persistent navigation sidebar shared by the admin panel and the account
 * settings.
 *
 * The API is deliberately generic over the string union of values it navigates:
 * the admin panel navigates between typed `AdminTab`s, the settings sidebar
 * between typed `SettingsTab`s, and both render exactly the same rows - icon,
 * label, badge, active state, and the collapse-to-icons behaviour that keeps a
 * long list readable on medium screens.
 */
export const AppSidebar = <T extends string>({
  activeValue,
  collapseAriaLabel,
  expandAriaLabel,
  navLabel,
  onSelect,
  sections,
  subtitle,
  title,
}: AppSidebarProps<T>) => {
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
              {title ? (
                <p className="text-foreground text-sm font-semibold">{title}</p>
              ) : null}
              {subtitle ? (
                <p className="text-muted-foreground text-xs">{subtitle}</p>
              ) : null}
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size={collapsed ? "icon" : "icon-sm"}
            aria-expanded={!collapsed}
            aria-label={collapsed ? expandAriaLabel : collapseAriaLabel}
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

        <NavList
          activeValue={activeValue}
          collapsed={collapsed}
          navLabel={navLabel}
          onSelect={onSelect}
          sections={sections}
        />
      </div>
    </aside>
  );
};

interface AppSidebarDrawerProps<T extends string> extends SidebarNavProps<T> {
  /** Label of the trigger button and the sheet heading. */
  sheetTitle?: string;
  /** Helper copy under the sheet heading. */
  sheetDescription?: string;
  /** Label of the mobile trigger button. */
  triggerLabel?: string;
}

/**
 * The same navigation in a drawer, for screens below the sidebar breakpoint.
 */
export const AppSidebarDrawer = <T extends string>({
  activeValue,
  navLabel,
  onSelect,
  sections,
  sheetTitle = "Menu",
  sheetDescription,
  triggerLabel = "Menu",
}: AppSidebarDrawerProps<T>) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="outline" className="min-h-11 lg:hidden" />}
      >
        <IconMenu2 aria-hidden="true" />
        {triggerLabel}
      </SheetTrigger>

      <SheetContent side="left" className="w-[min(20rem,85vw)]">
        <SheetHeader>
          <SheetTitle>{sheetTitle}</SheetTitle>
          {sheetDescription ? (
            <SheetDescription>{sheetDescription}</SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="overflow-y-auto px-3 pb-4">
          <NavList
            activeValue={activeValue}
            collapsed={false}
            navLabel={navLabel}
            onSelect={(value) => {
              onSelect(value);
              setOpen(false);
            }}
            sections={sections}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
