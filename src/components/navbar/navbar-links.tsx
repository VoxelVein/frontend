import { IconChevronDown } from "@tabler/icons-react";
import { Link, useMatchRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MINECRAFT_CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

const CONTENT_LINKS = [{ href: "/blog", label: "Blog" }] as const;

/** Shared with the landing page's explore section, so a category's route and
 * availability can never drift between the two. */
const PROJECT_ITEMS = MINECRAFT_CATEGORIES;

// The two destinations most people arrive for sit at the top of Products; the
// rest live one level deeper under Browse. See `alwaysInline` in
// `src/lib/categories.ts` for why that split exists.
const FEATURED_ITEMS = PROJECT_ITEMS.filter((item) => item.alwaysInline);
const BROWSE_ITEMS = PROJECT_ITEMS.filter((item) => !item.alwaysInline);

const linkClassName =
  "text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none";

/**
 * The drawer's row treatment, shared with the signed-in account links so the
 * mobile menu reads as one list rather than a styled navigation section with a
 * differently styled account block underneath.
 */
const MOBILE_LINK_CLASS =
  "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring min-h-11 flex items-center rounded-lg px-3 py-3 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none";

const MOBILE_SECTION_HEADING_CLASS =
  "text-muted-foreground mb-1 px-3 py-2 text-xs font-semibold tracking-wider uppercase";

const activeLinkClassName =
  "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary";

/**
 * How long the pointer must rest on "Products" before the menu opens.
 *
 * Longer than Base UI's 100ms default on purpose: the navbar is a 64px strip
 * that sits directly on the path to the sign-in button and the theme toggle,
 * so the pointer crosses it constantly. A short delay fires the menu on every
 * sweep toward the right-hand controls.
 */
const PRODUCTS_OPEN_DELAY_MS = 200;

/**
 * Grace period before a hover-opened menu closes.
 *
 * Base UI bridges the gap to the portalled popup with a Floating UI safe
 * polygon, so this is not what makes the diagonal move from trigger to menu
 * work. It is forgiveness for the fumbled exit - drifting off the trigger
 * should not snap the menu shut mid-decision.
 */
const PRODUCTS_CLOSE_DELAY_MS = 100;

/**
 * One row in either level of the Products menu.
 *
 * Exported only through the two menu-body components below; keeping the icon,
 * label and description together is what makes the dropdown read like the
 * explore grid it mirrors.
 */
const ProductItem = ({
  isActive,
  item,
}: {
  isActive: (href: string) => boolean;
  item: (typeof PROJECT_ITEMS)[number];
}) => (
  <DropdownMenuItem
    render={
      <Link
        to={item.href}
        preload="intent"
        aria-current={isActive(item.href) ? "page" : undefined}
      />
    }
    className="text-muted-foreground data-highlighted:bg-muted data-highlighted:text-foreground aria-[current=page]:text-primary min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2.5"
  >
    <item.icon
      size={18}
      stroke={1.8}
      aria-hidden="true"
      className="text-primary mt-0.5"
    />
    <span className="grid gap-0.5">
      <span className="text-foreground text-sm font-medium">{item.label}</span>
      <span className="text-muted-foreground text-xs leading-snug">
        {item.description}
      </span>
    </span>
  </DropdownMenuItem>
);

/**
 * The sections that do not get a top-level link, with their descriptions.
 *
 * Exported so a test can render it inside an already-open menu. Base UI portals
 * the popup and only mounts it while open, and driving it open through pointer
 * events is not practical in jsdom.
 */
const BrowseMenuItems = ({
  isActive,
}: {
  isActive: (href: string) => boolean;
}) => (
  <>
    {BROWSE_ITEMS.map((item) => (
      <ProductItem isActive={isActive} item={item} key={item.href} />
    ))}
  </>
);

/**
 * The contents of the Products dropdown: the two featured types first, then
 * every other type behind a Browse submenu.
 */
const ProductsMenuItems = ({
  isActive,
}: {
  isActive: (href: string) => boolean;
}) => (
  <>
    {FEATURED_ITEMS.map((item) => (
      <ProductItem isActive={isActive} item={item} key={item.href} />
    ))}

    <DropdownMenuSeparator className="border-border/70 my-1 border-t" />

    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="text-muted-foreground data-highlighted:bg-muted data-highlighted:text-foreground min-h-11 gap-3 rounded-lg px-2.5 py-2.5">
        Browse
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-80 sm:min-w-96">
        <BrowseMenuItems isActive={isActive} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  </>
);

const ProductsMenu = ({
  isActive,
}: {
  isActive: (href: string) => boolean;
}) => {
  const hasActiveProduct = PROJECT_ITEMS.some((item) => isActive(item.href));

  return (
    <DropdownMenu>
      {/* Hover to open, click to pin, click away to dismiss. Base UI implements
          all four behaviours from these three props, so there is no hover state
          to keep in sync here. Keyboard users get the plain click-to-open menu;
          hover is a mouse-only shortcut layered over it. */}
      <DropdownMenuTrigger
        closeDelay={PRODUCTS_CLOSE_DELAY_MS}
        delay={PRODUCTS_OPEN_DELAY_MS}
        openOnHover
        render={(props) => (
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "group text-muted-foreground hover:bg-muted/60 hover:text-foreground min-h-11 gap-1 px-3 text-sm font-medium",
              hasActiveProduct && activeLinkClassName
            )}
            {...props}
          />
        )}
      >
        Products
        <IconChevronDown
          size={15}
          stroke={1.8}
          aria-hidden="true"
          className="transition-transform duration-200 group-data-popup-open:rotate-180 motion-reduce:transition-none"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="min-w-80 sm:min-w-96"
      >
        <ProductsMenuItems isActive={isActive} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const NavbarLinks = () => {
  const matchRoute = useMatchRoute();

  const isActive = (href: string) => !!matchRoute({ fuzzy: true, to: href });

  const renderLink = (href: string, label: string) => (
    <Link
      key={href}
      to={href}
      preload="intent"
      aria-current={isActive(href) ? "page" : undefined}
      className={cn(linkClassName, isActive(href) && activeLinkClassName)}
    >
      {label}
    </Link>
  );

  return (
    <nav
      aria-label="Main navigation"
      className="hidden items-center gap-1 lg:flex"
    >
      {renderLink("/", "Home")}

      <ProductsMenu isActive={isActive} />

      {CONTENT_LINKS.map((link) => renderLink(link.href, link.label))}
    </nav>
  );
};

export {
  BrowseMenuItems,
  CONTENT_LINKS,
  MOBILE_LINK_CLASS,
  MOBILE_SECTION_HEADING_CLASS,
  NavbarLinks,
  PROJECT_ITEMS,
  ProductsMenuItems,
};
