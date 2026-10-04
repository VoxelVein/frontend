import { IconArrowRight } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import { RotatingText } from "@/components/motion/rotating-text";
import { buttonVariants } from "@/components/ui/button-variants";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { MINECRAFT_CATEGORIES, categoryLabelSentence } from "@/lib/categories";
import { cn } from "@/lib/utils";

/**
 * The types the rotating headline cycles through, read from the category
 * registry rather than typed out here.
 *
 * A hardcoded list drifted once already: it advertised `Datapacks`, which is
 * not a project type and has no browse route, while omitting `Servers`, which
 * is one of the live categories a visitor most wants to find. Deriving the
 * list from `MINECRAFT_CATEGORIES` makes that class of drift impossible.
 */
const PROJECT_TYPES = MINECRAFT_CATEGORIES.map((category) => category.label);

/** "mods, plugins, modpacks, resource packs, shaders, servers, and datapacks". */
const TYPE_SENTENCE = categoryLabelSentence();

/**
 * The fixed half of the headline, which the rotating category completes.
 *
 * "Find your next" is deliberately the visitor's half of the sentence rather
 * than the site's: it says what the reader is here to do, and it survives every
 * category the rotation can land on. The subhead below it no longer repeats
 * this list — two seven-item lists inside one screen read as a wall of text
 * and buried the actual promise.
 */
const HEADLINE_PREFIX = "Find your next";

const Hero = () => {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <section className="px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-20 lg:px-8 lg:pt-36 lg:pb-24">
      <div className="animate-hero-enter mx-auto max-w-4xl text-center">
        <h1 className="text-foreground mb-6 text-4xl font-bold tracking-tight text-balance sm:mb-8 sm:text-5xl lg:text-6xl">
          {/* The rotation is decorative; screen readers get one stable
              sentence instead of an announcement every two seconds. */}
          <span className="sr-only">
            {`${HEADLINE_PREFIX} ${TYPE_SENTENCE}`}
          </span>
          <span
            aria-hidden="true"
            className="flex flex-col items-center gap-3 sm:gap-4"
          >
            <span>{HEADLINE_PREFIX}</span>
            <RotatingText
              texts={PROJECT_TYPES}
              paused={reduceMotion}
              textClassName="px-2.5 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2"
              splitLevelClassName="pb-0.5 sm:pb-1"
            />
          </span>
        </h1>

        <p className="text-muted-foreground mx-auto mb-10 max-w-2xl text-lg leading-relaxed sm:mb-12 sm:text-xl">
          Every kind of Minecraft project in one place — published by the people
          who build it, free and open source, forever.
        </p>

        {/* Two calls to action, not one. The old hero offered browsing only, so
            half the audience — the people who make these things — had no way in
            from here even though publishing is the other half of the site's
            job. Stacked on mobile, side by side from `sm` up. */}
        <div className="animate-hero-enter-lag flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            to="/mods"
            className={cn(
              buttonVariants({ size: "lg", variant: "default" }),
              "ease-smooth min-h-12 gap-2 px-6 text-base transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
            )}
            preload="intent"
          >
            <span>Browse projects</span>
            <IconArrowRight size={18} />
          </Link>
          <Link
            to="/signup"
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "ease-smooth min-h-12 px-6 text-base transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
            )}
            preload="intent"
          >
            Join free
          </Link>
        </div>
      </div>
    </section>
  );
};

export { Hero };
