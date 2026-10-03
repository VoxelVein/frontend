import { cn } from "cn";

import type { PostSummary } from "@/lib/posts";
import { POST_CATEGORIES, postCategoryLabel } from "@/lib/posts";

interface PostCategoryFilterProps {
  /** The posts the counts are taken from — the full listing, not search hits. */
  posts: PostSummary[];
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

/**
 * The categories actually present in the listing, in the project's declared
 * order rather than by count.
 *
 * Derived from the data so a filter never offers a category with nothing behind
 * it. A `Set` collapses a list of posts into one entry per category in a single
 * pass, rather than filtering and mapping the array twice to say the same thing.
 *
 * A category outside the declared list can only have come from a row edited
 * outside the app. It is still real, so it is offered at the end rather than
 * hidden.
 */
const categoriesIn = (posts: PostSummary[]): string[] => {
  const present = new Set<string>();
  for (const post of posts) {
    if (post.category !== null) {
      present.add(post.category);
    }
  }

  const declared: string[] = [];
  for (const category of POST_CATEGORIES) {
    if (present.has(category.value)) {
      declared.push(category.value);
    }
  }

  const undeclared: string[] = [];
  for (const value of present) {
    if (!POST_CATEGORIES.some((category) => category.value === value)) {
      undeclared.push(value);
    }
  }

  return [...declared, ...undeclared];
};

const filterButtonClass = (isActive: boolean) =>
  cn(
    "focus-visible:ring-ring focus-visible:ring-ring/50 inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none",
    isActive
      ? "bg-foreground text-background"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  );

const countClass = (isActive: boolean) =>
  cn(
    "text-xs tabular-nums",
    isActive ? "text-background/70" : "text-muted-foreground/70"
  );

/**
 * The button's accessible name, stated rather than assembled.
 *
 * JSX drops the whitespace between the label and the count, so reading the
 * name off the rendered children gives "Engineering2" while the button looks
 * like "Engineering 2" — the gap is `gap-2`. Naming the button explicitly keeps
 * what is announced identical to what is shown, and is the only chance to say
 * that the number means posts rather than leaving a bare digit.
 */
const categoryButtonLabel = (label: string, count: number): string =>
  `${label}, ${count} ${count === 1 ? "post" : "posts"}`;

/**
 * Narrows the blog to one category at a time.
 *
 * Toggle buttons rather than tabs: filtering a list does not change what page
 * you are on, so the tab pattern — which claims to move focus between panels —
 * would be describing something that is not happening. `aria-pressed` on each
 * button inside a `fieldset` says exactly what is true.
 *
 * "All" is the resting state and is always offered, so there is a way back
 * without toggling the active button off and leaving nothing pressed.
 */
const PostCategoryFilter = ({
  activeCategory,
  onCategoryChange,
  posts,
}: PostCategoryFilterProps) => {
  const categories = categoriesIn(posts);

  // One category means the control can only ever do what it already does.
  if (categories.length < 2) {
    return null;
  }

  const counts = new Map<string, number>();
  for (const post of posts) {
    if (post.category !== null) {
      counts.set(post.category, (counts.get(post.category) ?? 0) + 1);
    }
  }

  return (
    <fieldset className="mt-6">
      {/* The label names the control for anyone who cannot see the pill shape;
          the visible buttons describe themselves, so it is not repeated on
          screen. */}
      <legend className="sr-only">Filter by category</legend>

      <div className="flex flex-wrap gap-2">
        <button
          aria-pressed={activeCategory === null}
          className={filterButtonClass(activeCategory === null)}
          type="button"
          onClick={() => {
            onCategoryChange(null);
          }}
        >
          All
        </button>

        {categories.map((value) => {
          const isActive = activeCategory === value;
          const label = postCategoryLabel(value) ?? value;
          const count = counts.get(value) ?? 0;

          return (
            <button
              key={value}
              aria-label={categoryButtonLabel(label, count)}
              aria-pressed={isActive}
              className={filterButtonClass(isActive)}
              type="button"
              onClick={() => {
                onCategoryChange(value);
              }}
            >
              {label}
              {/* Hidden from assistive technology: the button's own name
                  already carries the count, in words. */}
              <span aria-hidden="true" className={countClass(isActive)}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
};

export { PostCategoryFilter };
