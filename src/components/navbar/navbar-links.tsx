import { IconChevronDown } from "@tabler/icons-react";
import { Link, useMatchRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MINECRAFT_CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

const CONTENT_LINKS = [{ href: "/blog", label: "Blog" }] as const;

// Shared with the landing page's explore section, so a category's route and
// availability can never drift between the two.
const PROJECT_ITEMS = MINECRAFT_CATEGORIES;

const linkClassName =
  "text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none";

const activeLinkClassName = "bg-muted text-foreground";

const SoonBadge = () => (
  <span className="border-border rounded-full border px-1.5 text-xs leading-4">
    Soon
  </span>
);

const upcomingItems = PROJECT_ITEMS.filter((item) => !item.available);

// Between `lg` and `xl` the upcoming sections do not fit inline, so they
// collapse into this menu instead of disappearing.
const UpcomingMenu = () => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={(props) => (
        <Button
          type="button"
          variant="ghost"
          className="group text-muted-foreground hover:text-foreground min-h-11 gap-1 px-3 text-sm font-medium xl:hidden"
          {...props}
        />
      )}
    >
      More
      <IconChevronDown
        size={15}
        stroke={1.8}
        aria-hidden="true"
        className="transition-transform duration-200 group-data-popup-open:rotate-180 motion-reduce:transition-none"
      />
    </DropdownMenuTrigger>

    <DropdownMenuContent align="start" sideOffset={8} className="min-w-56">
      {upcomingItems.map((item) => (
        <DropdownMenuItem
          key={item.href}
          disabled
          className="text-muted-foreground flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium data-disabled:opacity-100"
        >
          <item.icon size={16} stroke={1.8} aria-hidden="true" />
          <span className="flex-1">{item.label}</span>
          <SoonBadge />
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

const NavbarLinks = () => {
  const matchRoute = useMatchRoute();

  const renderLink = (href: string, label: string) => {
    const isActive = !!matchRoute({ fuzzy: true, to: href });

    return (
      <Link
        key={href}
        to={href}
        preload="intent"
        aria-current={isActive ? "page" : undefined}
        className={cn(linkClassName, isActive && activeLinkClassName)}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main navigation"
      className="hidden items-center gap-1 lg:flex"
    >
      {PROJECT_ITEMS.map((item) => {
        if (item.available) {
          return renderLink(item.href, item.label);
        }
        // Upcoming sections are not links yet, so they are shown as plain
        // text with a "Soon" note. Below `xl` they move into UpcomingMenu.
        return (
          <span
            key={item.href}
            className="text-muted-foreground/70 hidden min-h-11 items-center gap-1.5 px-3 py-2 text-sm font-medium xl:inline-flex"
          >
            {item.label}
            <SoonBadge />
          </span>
        );
      })}

      {upcomingItems.length > 0 ? <UpcomingMenu /> : null}

      <span aria-hidden="true" className="bg-border mx-1 h-5 w-px" />

      {CONTENT_LINKS.map((link) => renderLink(link.href, link.label))}
    </nav>
  );
};

export { CONTENT_LINKS, NavbarLinks, PROJECT_ITEMS };
