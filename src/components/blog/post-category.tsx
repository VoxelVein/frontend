import { cn } from "cn";

import { postCategoryLabel } from "@/lib/posts";

interface PostCategoryBadgeProps {
  /** Null means uncategorised, which renders nothing at all. */
  category: string | null;
  className?: string;
  /**
   * How prominent the chip is.
   *
   * `default` is for a post's own header, where the category is one of the facts
   * being announced. `subtle` is for listings, where a column of six chips
   * stacked above six titles competes with the titles themselves.
   */
  variant?: "default" | "subtle";
}

/**
 * A post's category as a small label.
 *
 * A label and not a link. There is no per-category page to link to — the
 * category filter on the blog index is client-side over the posts already loaded
 * — so a chip that looked clickable would be a dead control, and the blog index
 * filter is what a category is actually for.
 *
 * An uncategorised post renders no chip rather than "Uncategorised". Half the
 * archive is uncategorised by design, and a chip on every second card would say
 * less than its absence does.
 */
const PostCategoryBadge = ({
  category,
  className,
  variant = "default",
}: PostCategoryBadgeProps) => {
  const label = postCategoryLabel(category);

  if (label === null) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full font-medium whitespace-nowrap",
        variant === "default"
          ? "bg-primary/10 text-primary px-2.5 py-1 text-xs"
          : "bg-muted text-muted-foreground px-2 py-0.5 text-xs",
        className
      )}
    >
      {label}
    </span>
  );
};

export { PostCategoryBadge };
