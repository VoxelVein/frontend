import { IconArrowRight } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import { Logo } from "@/components/logo";
import { RotatingText } from "@/components/motion/rotating-text";
import { buttonVariants } from "@/components/ui/button-variants";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

const PROJECT_TYPES = [
  "Mods",
  "Plugins",
  "Modpacks",
  "Datapacks",
  "Resource Packs",
  "Shaders",
] as const;

const Hero = () => {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <section className="px-4 pt-14 pb-12 sm:px-6 lg:px-8">
      <div className="animate-hero-fade-in mx-auto max-w-4xl text-center">
        <div className="mb-8 flex justify-center">
          <Logo className="h-20 w-20" />
        </div>

        <h1 className="text-foreground mb-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          {/* The rotation is decorative; screen readers get one stable
              sentence instead of an announcement every two seconds. */}
          <span className="sr-only">
            Discover the best mods, plugins, modpacks, datapacks, resource
            packs, and shaders
          </span>
          <span aria-hidden="true" className="flex flex-col items-center gap-3">
            <span>Discover the best</span>
            <RotatingText
              texts={PROJECT_TYPES}
              paused={reduceMotion}
              textClassName="px-2 py-0.5 sm:py-1 md:px-3 md:py-2"
              splitLevelClassName="pb-0.5 sm:pb-1"
            />
          </span>
        </h1>

        <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg leading-8">
          Discover mods, modpacks, resource packs, shaders, plugins, and more
          from the Minecraft community.
        </p>

        <div className="animate-hero-fade-in-delay flex items-center justify-center">
          <Link
            to="/mods"
            className={cn(
              buttonVariants({ size: "lg", variant: "default" }),
              "ease-smooth min-h-11 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
            )}
          >
            Browse Mods
            <IconArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export { Hero };
