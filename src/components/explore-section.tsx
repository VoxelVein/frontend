import { Link } from "@tanstack/react-router";

import { FilledPill } from "@/components/filled-pill";
import { Reveal } from "@/components/reveal";
import { MINECRAFT_CATEGORIES } from "@/lib/categories";
import type { MinecraftCategory } from "@/lib/categories";
import { staggerDelay } from "@/lib/reveal-stagger";
import { cn } from "@/lib/utils";

/**
 * Marks a category whose browse route does not exist yet.
 *
 * Nothing is currently unavailable — every entry in `MINECRAFT_CATEGORIES` has
 * `available: true` — so the badge is dormant. It stays because the registry
 * carries the flag as part of its contract, and a category added with
 * `available: false` should read as "Soon" without a second edit here.
 */
const SoonBadge = () => (
  <span className="border-border text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium">
    Soon
  </span>
);

/**
 * One category, as a single target.
 *
 * Three changes from the tile this replaces:
 *
 * **No "Browse →" footer.** The whole tile is already one link, so the footer
 * said the same thing twice on every card and gave each one a dead strip at the
 * bottom. The affordance is now the icon, which fills with the accent colour on
 * hover, plus the title taking the accent — the same treatment the browse page's
 * cards use.
 *
 * **A larger icon tile.** At `size-12` the glyph was smaller than the title
 * beside it and the card read as a heading with a decoration. `size-14` makes it
 * the thing you land on first, which is right: it is the only thing that
 * distinguishes one category card from another at a glance.
 *
 * **A lighter hover.** Only the border and the contents move; the card no longer
 * lifts, because seven cards lifting together is a lot of motion for a grid of
 * navigation rather than content.
 */
const CategoryTile = ({ category }: { category: MinecraftCategory }) => {
  const { available, description, href, icon: Icon, label } = category;

  return (
    <article
      className={cn(
        "border-border ease-smooth relative flex h-full flex-col rounded-xl border p-6",
        "transition-colors duration-200 motion-reduce:transition-none",
        available
          ? "group bg-card hover:border-primary/30 focus-within:border-primary/30"
          : "bg-muted/30"
      )}
    >
      {/* The whole tile is one link, matching ProjectCard. It sits above the
          text so the non-interactive content never steals the pointer, while
          staying a real link for keyboard and screen reader users. */}
      {available ? (
        <Link
          className="focus-visible:ring-ring absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:outline-none"
          preload="intent"
          to={href}
        >
          <span className="sr-only">Browse {label}</span>
        </Link>
      ) : null}

      <div
        className={cn(
          "flex size-14 shrink-0 items-center justify-center rounded-xl",
          "transition-colors duration-200 motion-reduce:transition-none",
          available
            ? "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground group-focus-within:bg-primary group-focus-within:text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon aria-hidden="true" size={26} stroke={1.7} />
      </div>

      <h3 className="text-foreground group-hover:text-primary mt-5 mb-2 text-lg font-semibold tracking-tight transition-colors duration-200 motion-reduce:transition-none">
        {label}
      </h3>

      <p className="text-muted-foreground text-sm leading-6">{description}</p>

      {available ? null : (
        <div className="mt-5">
          <SoonBadge />
        </div>
      )}
    </article>
  );
};

const ExploreSection = () => (
  <section
    id="browse"
    aria-labelledby="browse-heading"
    className="px-4 py-16 sm:px-6 lg:px-8"
  >
    <div className="mx-auto max-w-7xl">
      <Reveal className="mx-auto max-w-3xl text-center">
        {/* The filled pill echoes the hero's rotating-text pill, which anchors
            this page's accent treatment. */}
        <h2
          className="text-foreground mx-auto text-3xl font-bold tracking-tight text-balance sm:text-4xl"
          id="browse-heading"
        >
          Explore <FilledPill>Minecraft</FilledPill>
        </h2>

        <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg leading-8">
          {`${MINECRAFT_CATEGORIES.length} ways into the community's work — pick one and start digging.`}
        </p>
      </Reveal>

      <ul className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MINECRAFT_CATEGORIES.map((category, index) => (
          <li className="h-full" key={category.href}>
            <Reveal className="h-full" delay={staggerDelay(index)}>
              <CategoryTile category={category} />
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export { ExploreSection };
