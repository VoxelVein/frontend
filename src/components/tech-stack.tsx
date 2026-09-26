import { IconArrowUpRight, IconBrandGithub } from "@tabler/icons-react";
import {
  SiBetterauth,
  SiCloudflare,
  SiDrizzle,
  SiMeilisearch,
  SiPostgresql,
  SiReact,
  SiShadcnui,
  SiTailwindcss,
  SiTanstack,
  SiTypescript,
} from "react-icons/si";

import { LogoLoop } from "@/components/logo-loop";
import type { LogoItem } from "@/components/logo-loop";
import { Reveal } from "@/components/reveal";

const STACK_LOGOS: LogoItem[] = [
  { href: "https://react.dev", node: <SiReact />, title: "React" },
  {
    href: "https://www.typescriptlang.org",
    node: <SiTypescript />,
    title: "TypeScript",
  },
  { href: "https://tanstack.com", node: <SiTanstack />, title: "TanStack" },
  {
    href: "https://tailwindcss.com",
    node: <SiTailwindcss />,
    title: "Tailwind CSS",
  },
  { href: "https://ui.shadcn.com", node: <SiShadcnui />, title: "shadcn/ui" },
  {
    href: "https://orm.drizzle.team",
    node: <SiDrizzle />,
    title: "Drizzle ORM",
  },
  {
    href: "https://www.postgresql.org",
    node: <SiPostgresql />,
    title: "PostgreSQL",
  },
  {
    href: "https://www.meilisearch.com",
    node: <SiMeilisearch />,
    title: "Meilisearch",
  },
  {
    href: "https://better-auth.com",
    node: <SiBetterauth />,
    title: "Better Auth",
  },
  {
    href: "https://www.cloudflare.com",
    node: <SiCloudflare />,
    title: "Cloudflare",
  },
];

const GITHUB_URL = "https://github.com/VoxelVein";

/** Travel speed in pixels per second. */
const SPEED = 50;
/**
 * Hovering eases the loop down to this fraction of `SPEED` rather than
 * stopping it. A hard stop reads as broken and leaves nothing to follow with
 * the pointer, whereas a crawl keeps the row legible and a logo reachable
 * under the cursor.
 */
const HOVER_SPEED_FRACTION = 0.3;

const TechStack = () => (
  <section
    aria-labelledby="tech-stack-heading"
    className="overflow-hidden px-4 py-12 sm:px-6 sm:py-14 lg:px-8"
    id="tech-stack"
  >
    <div className="mx-auto max-w-7xl">
      <Reveal className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-2 text-sm font-medium">
            Under the hood
          </p>

          <h2
            className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl"
            id="tech-stack-heading"
          >
            Built on a modern stack
          </h2>

          <p className="text-muted-foreground mt-2 max-w-prose text-sm sm:text-base">
            The same tools we use to run VoxelVein, open source and in
            production.
          </p>
        </div>

        <a
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring group hidden min-h-11 shrink-0 items-center gap-1 rounded-md text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none sm:inline-flex"
          href={GITHUB_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          <IconBrandGithub aria-hidden size={16} />
          Source
          <IconArrowUpRight
            aria-hidden
            className="transition-transform duration-200 group-hover:translate-x-0.5"
            size={14}
          />
        </a>
      </Reveal>

      <div className="border-border bg-card rounded-xl border px-4 py-6 sm:px-6">
        <LogoLoop
          ariaLabel="Technologies VoxelVein is built on"
          direction="left"
          fadeOut
          fadeOutColor="var(--color-card)"
          gap={40}
          hoverSpeed={SPEED * HOVER_SPEED_FRACTION}
          logoHeight={36}
          logos={STACK_LOGOS}
          scaleOnHover
          speed={SPEED}
        />
      </div>

      <div className="mt-4 flex justify-center sm:hidden">
        <a
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          href={GITHUB_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          <IconBrandGithub aria-hidden size={15} />
          View the source
          <IconArrowUpRight aria-hidden size={14} />
        </a>
      </div>
    </div>
  </section>
);

export { TechStack };
