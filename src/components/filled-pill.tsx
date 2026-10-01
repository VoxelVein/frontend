import { cn } from "@/lib/utils";

interface FilledPillProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * The filled accent pill.
 *
 * This is the landing page's accent treatment, originally inline in the hero
 * and the "Explore Minecraft" heading. It is exported because the hero, the
 * explore heading, and the creator dashboard all use the same shape, and three
 * copies of the same class string is how they would drift.
 */
export const FilledPill = ({ children, className }: FilledPillProps) => (
  <span
    className={cn(
      "bg-primary text-primary-foreground inline-block rounded-lg px-2.5 py-1 align-middle",
      className
    )}
  >
    {children}
  </span>
);
