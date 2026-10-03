import { IconArrowRight } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import { FilledPill } from "@/components/filled-pill";
import { Reveal } from "@/components/reveal";
import { MINECRAFT_CATEGORIES, categoryLabelSentence } from "@/lib/categories";
import type { MinecraftCategory } from "@/lib/categories";
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

const CategoryTile = ({ category }: { category: MinecraftCategory }) => {
  const { available, description, href, icon: Icon, label } = category;

  return (
    <article
      className={cn(
        "border-border ease-smooth relative flex h-full flex-col rounded-lg border p-6",
        "transition-transform duration-300 motion-reduce:transform-none motion-reduce:transition-none",
        available
          ? "group bg-card focus-within:border-foreground/20 hover:border-foreground/20 focus-within:-translate-y-0.5 hover:-translate-y-0.5"
          : "bg-muted/30"
      )}
    >
      {/* The whole tile is one link, matching ProjectCard. It sits above the
          text so the non-interactive content never steals the pointer, while
          staying a real link for keyboard and screen reader users. */}
      {available ? (
        <Link
          className="focus-visible:ring-ring absolute inset-0 z-10 rounded-2xl focus-visible:ring-2 focus-visible:outline-none"
          preload="intent"
          to={href}
        >
          <span className="sr-only">Browse {label}</span>
        </Link>
      ) : null}

      <div
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl",
          available
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon aria-hidden="true" size={24} stroke={1.8} />
      </div>

      <h3 className="mt-5 mb-2 text-lg font-semibold tracking-tight">
        {label}
      </h3>

      <p className="text-muted-foreground text-sm leading-6">{description}</p>

      {/* `mt-auto` pins the footer to the bottom so the tiles line up across
          the row regardless of description length. */}
      <div className="mt-6 flex min-h-11 items-center pt-2 text-sm font-medium">
        {available ? (
          <>
            <span className="text-primary group-hover:underline">Browse</span>
            <IconArrowRight
              aria-hidden="true"
              className="text-primary ease-smooth ml-1.5 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none"
              size={16}
            />
          </>
        ) : (
          <SoonBadge />
        )}
      </div>
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
          {`${MINECRAFT_CATEGORIES.length} ways into the community's work. Browse ${categoryLabelSentence()}.`}
        </p>
      </Reveal>

      <ul className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MINECRAFT_CATEGORIES.map((category, index) => (
          <li className="h-full" key={category.href}>
            <Reveal className="h-full" delay={index * 0.06}>
              <CategoryTile category={category} />
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export { ExploreSection };
