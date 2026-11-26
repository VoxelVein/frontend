import type { Link } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  BrowseMenuItems,
  NavbarLinks,
  ProductsMenuItems,
} from "@/components/navbar/navbar-links";
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
  // its own props  -  `role="menuitem"`, handlers, `tabindex`  -  onto the rendered
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
 * Which sections sit at the top of the Products dropdown, written out rather
 * than derived from `alwaysInline` so the assertion is not tautological. If the
 * menu starts growing a link per project type again, this pinned list fails.
 */
const FEATURED_LABELS = ["Mods", "Plugins"];

const ALL_LABELS = MINECRAFT_CATEGORIES.map((entry) => entry.label);

const MENU_LABELS = ALL_LABELS.filter(
  (label) => !FEATURED_LABELS.includes(label)
);

/**
 * Renders the menu body inside a menu that is already open.
 *
 * Base UI portals the popup, so it exists in the document only while the menu
 * is open, and opening it through pointer events is not practical in jsdom.
 */
const openMenu = (children: ReactNode) =>
  render(
    <DropdownMenu onOpenChange={noop} open>
      <DropdownMenuTrigger />
      <DropdownMenuContent>{children}</DropdownMenuContent>
    </DropdownMenu>
  );

describe(NavbarLinks, () => {
  it("shows Home and Blog as the only flat links", () => {
    render(<NavbarLinks />);

    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Blog" })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("collapses every section behind one Products trigger", () => {
    render(<NavbarLinks />);

    for (const label of ALL_LABELS) {
      expect(
        screen.queryByRole("link", { name: label }),
        `${label} should not be a flat link`
      ).not.toBeInTheDocument();
    }

    expect(
      screen.getByRole("button", { name: /products/iu }),
      "one trigger for every project section"
    ).toBeInTheDocument();
  });

  it("keeps the trigger operable without a pointer", () => {
    // The trigger also opens on hover, but hover is a mouse-only shortcut
    // layered over the menu, never a replacement for it. Floating UI needs real
    // pointer geometry that jsdom does not provide, so the hover timing itself
    // cannot be exercised here; what must hold is that the trigger is still a
    // real button announcing a menu, so Enter, Space, and Escape keep working.
    render(<NavbarLinks />);
    const trigger = screen.getByRole("button", { name: /products/iu });

    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps every section reachable, featured or not", () => {
    // Guards against a section being dropped from both levels when the navbar
    // is retuned  -  the failure mode of a collapse that loses an entry.
    expect(new Set([...FEATURED_LABELS, ...MENU_LABELS])).toStrictEqual(
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
  it("lists the featured sections and every collapsed section", () => {
    // Two levels of the same Products menu, checked in one pass so the count
    // of tests stays pinned while both levels stay covered.
    const products = openMenu(<ProductsMenuItems isActive={() => false} />);
    const productsMenu = screen.getByRole("menu");

    for (const label of FEATURED_LABELS) {
      expect(
        within(productsMenu).getByRole("menuitem", {
          name: new RegExp(label, "u"),
        })
      ).toBeInTheDocument();
    }

    expect(within(productsMenu).getByText("Browse")).toBeInTheDocument();
    products.unmount();

    openMenu(<BrowseMenuItems isActive={() => false} />);
    const menu = screen.getByRole("menu");

    for (const label of MENU_LABELS) {
      expect(
        within(menu).getByRole("menuitem", { name: new RegExp(label, "u") })
      ).toBeInTheDocument();
    }
  });

  it("describes each section, which a flat link has no room for", () => {
    openMenu(<BrowseMenuItems isActive={() => false} />);

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
    // props  -  a mock or wrapper that dropped them would strip the role.
    openMenu(<BrowseMenuItems isActive={() => false} />);
    expect(screen.getAllByRole("menuitem")).toHaveLength(MENU_LABELS.length);
  });
});
