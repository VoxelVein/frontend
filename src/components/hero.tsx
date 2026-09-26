import { IconArrowRight } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import { Logo } from "@/components/logo";
import { ChromaticTextReveal } from "@/components/motion/chromatic-text-reveal";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

const Hero = () => (
  <section className="px-4 pt-14 pb-12 sm:px-6 lg:px-8">
    <div className="animate-hero-fade-in mx-auto max-w-4xl text-center">
      <div className="mb-8 flex justify-center">
        <Logo className="h-20 w-20" />
      </div>

      <h1 className="text-foreground mb-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
        Discover the best <ChromaticTextReveal /> projects
      </h1>

      <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg leading-8">
        Discover mods, modpacks, resource packs, shaders, plugins, and more from
        the Minecraft community.
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

export { Hero };
