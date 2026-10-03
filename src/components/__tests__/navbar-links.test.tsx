import type { Link } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { BrowseMenuItems, NavbarLinks } from "@/components/navbar/navbar-links";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MINECRAFT_CATEGORIES } from "@/lib/categories";

const { noop } = vi.hoisted(() => ({ noop: () => Promise.resolve() }));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- `Link` and `useMatchRoute` need a router instance; plain anchors keep these tests on the navbar's own behaviour
vi.mock("@tanstack/react-router", () => ({
  // Everything but `to` and `preload` is spread through, because Base UI merges
  // its own props — `role="menuitem"`, handlers, `tabindex` — onto the rendered
  // element. Dropping them would make the menu items unreachable by role.
  Link: ({
    children,
    preload: _preload,
    to,
    ...rest
  }: ComponentProps<typeof Link> & { children?: ReactNode }) => (
    <a {...rest} href={to}>
      {children}
    </a>
  ),
  useMatchRoute: () => () => false,
}));

/**
 * The navbar's density, written out rather than derived.
 *
 * Deriving these from the `alwaysInline` flag would make every assertion below
 * tautological: flipping a section to `alwaysInline` would move it from one
 * list to the other and the test would still pass. Which sections get a flat
 * link is a design decision, so it is pinned here as a literal — and this is
 * the assertion that fails if the bar starts growing a link per project type
 * again, which is how it reached seven.
 */
const FLAT_LABELS = ["Mods", "Plugins"];

const ALL_LABELS = MINECRAFT_CATEGORIES.map((entry) => entry.label);

const MENU_LABELS = ALL_LABELS.filter((label) => !FLAT_LABELS.includes(label));

/**
 * Renders the menu body inside a menu that is already open.
 *
 * Base UI portals the popup, so it exists in the document only while the menu
 * is open, and opening it through pointer events is not practical in jsdom.
 */
const openMenu = () =>
  render(
    <DropdownMenu onOpenChange={noop} open>
      <DropdownMenuTrigger />
      <DropdownMenuContent>
        <BrowseMenuItems isActive={() => false} />
      </DropdownMenuContent>
    </DropdownMenu>
  );

describe(NavbarLinks, () => {
  it("shows exactly two sections as flat links", () => {
    render(<NavbarLinks />);
    for (const label of FLAT_LABELS) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    // Two sections plus Blog.
    expect(screen.getAllByRole("link")).toHaveLength(FLAT_LABELS.length + 1);
  });

  it("collapses every other section behind one Browse trigger", () => {
    render(<NavbarLinks />);
    for (const label of MENU_LABELS) {
      expect(
        screen.queryByRole("link", { name: label }),
        `${label} should not be a flat link`
      ).not.toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: /browse/iu }),
      "one trigger for every collapsed section"
    ).toBeInTheDocument();
  });

  it("keeps the trigger operable without a pointer", () => {
    // The trigger also opens on hover, but hover is a mouse-only shortcut
    // layered over the menu, never a replacement for it. Floating UI needs real
    // pointer geometry that jsdom does not provide, so the hover timing itself
    // cannot be exercised here; what must hold is that the trigger is still a
    // real button announcing a menu, so Enter, Space, and Escape keep working.
    render(<NavbarLinks />);
    const trigger = screen.getByRole("button", { name: /browse/iu });

    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps every section reachable, flat or not", () => {
    // Guards against a section being dropped from both places when the navbar
    // is retuned — the failure mode of a collapse that loses an entry.
    expect(new Set([...FLAT_LABELS, ...MENU_LABELS])).toStrictEqual(
      new Set(ALL_LABELS)
    );
  });

  it("does not mark anything current while no route is active", () => {
    render(<NavbarLinks />);
    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });
});

describe(BrowseMenuItems, () => {
  it("lists every collapsed section", () => {
    openMenu();
    const menu = screen.getByRole("menu");
    for (const label of MENU_LABELS) {
      expect(
        within(menu).getByRole("menuitem", { name: new RegExp(label, "u") })
      ).toBeInTheDocument();
    }
  });

  it("describes each section, which a flat link has no room for", () => {
    openMenu();
    for (const label of MENU_LABELS) {
      const category = MINECRAFT_CATEGORIES.find(
        (entry) => entry.label === label
      );
      expect(
        screen.getByText(category?.description ?? "missing"),
        `${label} description`
      ).toBeInTheDocument();
    }
  });

  it("gives each entry a keyboard-reachable link role", () => {
    // Base UI puts `role="menuitem"` on the element it renders into. That only
    // survives because the menu item's `render` target forwards the merged
    // props — a mock or wrapper that dropped them would strip the role.
    openMenu();
    expect(screen.getAllByRole("menuitem")).toHaveLength(MENU_LABELS.length);
  });
});
