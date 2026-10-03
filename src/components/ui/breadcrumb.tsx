import { IconChevronRight } from "@tabler/icons-react";
import { cn } from "cn";
import type { ComponentProps } from "react";

/**
 * Breadcrumb trail.
 *
 * Hand-written rather than taken from shadcn: that version is built on Radix,
 * and this project's primitives are Base UI. Adding a second UI library for a
 * list of links would cost more than the twenty lines below.
 *
 * A breadcrumb is pure markup — there is no behaviour to abstract — so what
 * matters is the semantics, which are the accessibility contract here:
 *
 * * `Breadcrumb` is the `<nav>` landmark, so it is the one region named
 *   "breadcrumb" in the screen-reader rotor.
 * * `BreadcrumbList` is an `<ol>`, because a trail is an ordered sequence and
 *   that is what conveys "you came from here, through there".
 * * Each `BreadcrumbItem` wraps its `<li>`, so the count and the position come
 *   from the list rather than from ARIA.
 * * The final item is the current page and is marked `aria-current="page"`.
 *   It is deliberately not a link: the page you are already on has nowhere to
 *   go, and offering a link to it is a dead control.
 */
const Breadcrumb = ({ className, ...props }: ComponentProps<"nav">) => (
  <nav
    aria-label="Breadcrumb"
    data-slot="breadcrumb"
    className={cn("text-muted-foreground", className)}
    {...props}
  />
);

const BreadcrumbList = ({ className, ...props }: ComponentProps<"ol">) => (
  <ol
    data-slot="breadcrumb-list"
    className={cn("flex flex-wrap items-center gap-1.5 text-sm", className)}
    {...props}
  />
);

const BreadcrumbItem = ({ className, ...props }: ComponentProps<"li">) => (
  <li
    data-slot="breadcrumb-item"
    className={cn("inline-flex items-center gap-1.5", className)}
    {...props}
  />
);

/**
 * The current page: text, not a link.
 *
 * `aria-current="page"` is what tells assistive technology this is where you
 * are. Without it the trail reads as a plain list of links and gives no
 * indication of orientation.
 *
 * There is deliberately no `BreadcrumbLink` here. A wrapper that forwards props
 * to an `<a>` cannot declare its own children, so every caller would have to
 * restyle the router's `Link` at the call site anyway — and the router `Link`
 * renders the anchor itself, which is what actually needs navigating.
 */
const BreadcrumbCurrent = ({ className, ...props }: ComponentProps<"span">) => (
  <span
    aria-current="page"
    data-slot="breadcrumb-current"
    className={cn("text-foreground font-medium", className)}
    {...props}
  />
);

/**
 * The divider between two crumbs.
 *
 * Decorative, so it is hidden from assistive technology: a screen reader
 * announcing "chevron right" between every crumb adds noise and no information.
 */
const BreadcrumbSeparator = ({
  children,
  className,
  ...props
}: ComponentProps<"span">) => (
  <span
    aria-hidden="true"
    data-slot="breadcrumb-separator"
    className={cn("text-muted-foreground/60 inline-flex", className)}
    {...props}
  >
    {children ?? <IconChevronRight size={14} stroke={1.75} />}
  </span>
);

export {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
};
