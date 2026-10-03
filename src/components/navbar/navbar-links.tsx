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

// Mods and Plugins keep a flat link; the rest share one menu. See
// `alwaysInline` in `src/lib/categories.ts` for why.
const INLINE_ITEMS = PROJECT_ITEMS.filter((item) => item.alwaysInline);
const MENU_ITEMS = PROJECT_ITEMS.filter((item) => !item.alwaysInline);

const linkClassName =
  "text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none";

const activeLinkClassName = "bg-muted text-foreground";

/**
 * How long the pointer must rest on "Browse" before the menu opens.
 *
 * Longer than Base UI's 100ms default on purpose: the navbar is a 64px strip
 * that sits directly on the path to the sign-in button and the theme toggle,
 * so the pointer crosses it constantly. A short delay fires the menu on every
 * sweep toward the right-hand controls.
 */
const BROWSE_OPEN_DELAY_MS = 200;

/**
 * Grace period before a hover-opened menu closes.
 *
 * Base UI bridges the gap to the portalled popup with a Floating UI safe
 * polygon, so this is not what makes the diagonal move from trigger to menu
 * work. It is forgiveness for the fumbled exit — drifting off the trigger
 * should not snap the menu shut mid-decision.
 */
const BROWSE_CLOSE_DELAY_MS = 100;

/**
 * The sections that do not get a flat link, with their descriptions.
 *
 * Each row is icon, label, and the same one-line description the explore grid
 * shows. That is what earns its place here: a flat navbar link has nowhere to
 * put a description, so collapsing them into a menu would have only removed
 * navigation. Reusing the registry's copy keeps the two in step automatically.
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
    {MENU_ITEMS.map((item) => (
      <DropdownMenuItem
        key={item.href}
        render={
          <Link
            to={item.href}
            preload="intent"
            aria-current={isActive(item.href) ? "page" : undefined}
          />
        }
        className="text-muted-foreground data-highlighted:bg-muted data-highlighted:text-foreground aria-[current=page]:text-foreground min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2.5"
      >
        <item.icon
          size={18}
          stroke={1.8}
          aria-hidden="true"
          className="text-primary mt-0.5"
        />
        <span className="grid gap-0.5">
          <span className="text-foreground text-sm font-medium">
            {item.label}
          </span>
          <span className="text-muted-foreground text-xs leading-snug">
            {item.description}
          </span>
        </span>
      </DropdownMenuItem>
    ))}
  </>
);

const BrowseMenu = ({ isActive }: { isActive: (href: string) => boolean }) => (
  <DropdownMenu>
    {/* Hover to open, click to pin, click away to dismiss.
        Base UI implements all four behaviours of this menu's interaction
        model from these three props, so there is no hover state to keep in
        sync here:

        - `openOnHover` opens on pointer hover. It is mouse-only, so touch and
          keyboard are unaffected and still get the plain click-to-open menu.
        - `delay` is the rest time before hover opens it (see the constant).
        - `closeDelay` is the grace period on the way out (see the constant).
          Crossing to the portalled popup is handled by a Floating UI safe
          polygon rather than by this number.
        - Clicking a hover-opened menu pins it instead of closing it, for as
          long as the click took to arrive: Base UI ignores dismissals inside
          its 500ms `PATIENT_CLICK_THRESHOLD`, so an impatient click straight
          after the menu appears keeps it open rather than dismissing it. A
          click anywhere else on the page still dismisses it. */}
    <DropdownMenuTrigger
      closeDelay={BROWSE_CLOSE_DELAY_MS}
      delay={BROWSE_OPEN_DELAY_MS}
      openOnHover
      render={(props) => (
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "group text-muted-foreground hover:text-foreground min-h-11 gap-1 px-3 text-sm font-medium",
            MENU_ITEMS.some((item) => isActive(item.href)) &&
              activeLinkClassName
          )}
          {...props}
        />
      )}
    >
      Browse
      <IconChevronDown
        size={15}
        stroke={1.8}
        aria-hidden="true"
        className="transition-transform duration-200 group-data-popup-open:rotate-180 motion-reduce:transition-none"
      />
    </DropdownMenuTrigger>

    {/* A min-width rather than a width: the popup defaults to stretching to its
        trigger, and "Browse" is far narrower than these descriptions need. A
        min-width raises the floor without depending on how `cn` orders a
        conflicting `w-` utility against the base `w-(--anchor-width)`. */}
    <DropdownMenuContent
      align="start"
      sideOffset={8}
      className="min-w-80 sm:min-w-96"
    >
      <BrowseMenuItems isActive={isActive} />
    </DropdownMenuContent>
  </DropdownMenu>
);

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
      {INLINE_ITEMS.map((item) => renderLink(item.href, item.label))}

      <BrowseMenu isActive={isActive} />

      {CONTENT_LINKS.map((link) => renderLink(link.href, link.label))}
    </nav>
  );
};

export { BrowseMenuItems, CONTENT_LINKS, NavbarLinks, PROJECT_ITEMS };
