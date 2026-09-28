import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface RowIconProps {
  children: ReactNode;
  className?: string;
}

/**
 * The 40px icon tile at the leading edge of a settings or admin list row.
 *
 * Every one of those rows opens with a device, provider, or user mark in the
 * same bordered square. It is decorative in all of them — the row's own label
 * already names what it is — so it is hidden from assistive technology rather
 * than given a redundant accessible name.
 */
const RowIcon = ({ children, className }: RowIconProps) => (
  <span
    aria-hidden="true"
    className={cn(
      "border-border bg-background text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border",
      className
    )}
  >
    {children}
  </span>
);

export { RowIcon };
