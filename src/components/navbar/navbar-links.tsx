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

const overflowItems = PROJECT_ITEMS.filter((item) => !item.alwaysInline);

// Between `lg` and `xl` not every section fits inline, so the rest collapse
// into this menu instead of disappearing.
const OverflowMenu = ({
  isActive,
}: {
  isActive: (href: string) => boolean;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={(props) => (
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "group text-muted-foreground hover:text-foreground min-h-11 gap-1 px-3 text-sm font-medium xl:hidden",
            overflowItems.some((item) => isActive(item.href)) &&
              activeLinkClassName
          )}
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
      {overflowItems.map((item) => (
        <DropdownMenuItem
          key={item.href}
          render={
            <Link
              to={item.href}
              preload="intent"
              aria-current={isActive(item.href) ? "page" : undefined}
            />
          }
          className="text-muted-foreground data-highlighted:bg-muted data-highlighted:text-foreground aria-[current=page]:text-foreground flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
        >
          <item.icon size={16} stroke={1.8} aria-hidden="true" />
          {item.label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

const NavbarLinks = () => {
  const matchRoute = useMatchRoute();

  const isActive = (href: string) => !!matchRoute({ fuzzy: true, to: href });

  const renderLink = (href: string, label: string, className?: string) => (
    <Link
      key={href}
      to={href}
      preload="intent"
      aria-current={isActive(href) ? "page" : undefined}
      className={cn(
        linkClassName,
        isActive(href) && activeLinkClassName,
        className
      )}
    >
      {label}
    </Link>
  );

  return (
    <nav
      aria-label="Main navigation"
      className="hidden items-center gap-1 lg:flex"
    >
      {PROJECT_ITEMS.map((item) =>
        renderLink(
          item.href,
          item.label,
          item.alwaysInline ? undefined : "hidden xl:inline-flex"
        )
      )}

      <OverflowMenu isActive={isActive} />

      <span aria-hidden="true" className="bg-border mx-1 h-5 w-px" />

      {CONTENT_LINKS.map((link) => renderLink(link.href, link.label))}
    </nav>
  );
};

export { CONTENT_LINKS, NavbarLinks, PROJECT_ITEMS };
