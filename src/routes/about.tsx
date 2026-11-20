import {
  IconCode,
  IconGitBranch,
  IconPackage,
  IconTools,
} from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { Reveal } from "@/components/reveal";
import { buttonVariants } from "@/components/ui/button-variants";
import { SITE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

const PAGE_TITLE = "About VoxelVein";

/**
 * The call-to-action at the end of an AboutSection: a link to a destination
 * that answers the section, shown when there is one.
 */
interface AboutSectionAction {
  label: string;
  to: string;
}

/**
 * One section of the About page: a heading, a list of sentences, and an
 * optional action link. Simple declarative markup rather than a shared
 * abstraction: the sections are short enough that a component per kind would
 * cost more complexity than it saves.
 */
interface AboutSectionProps {
  /** Sentences describing the section. */
  text: string[];
  title: string;
  action?: AboutSectionAction;
}

const AboutSection = ({ text, title, action }: AboutSectionProps) => (
  <Reveal className="max-w-3xl">
    <h2 className="text-foreground mt-8 border-t border-b py-5 text-2xl font-bold tracking-tight sm:text-3xl">
      {title}
    </h2>
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div>
        {text.map((sentence) => (
          <p
            className="text-muted-foreground mt-3 text-sm leading-7 sm:text-base"
            key={sentence}
          >
            {sentence}
          </p>
        ))}
      </div>
      {action ? (
        <Link
          className={cn(
            buttonVariants({ variant: "outline" }),
            "ease-smooth min-h-11 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
          )}
          preload="intent"
          to={action.to}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  </Reveal>
);

const AboutPage = () => (
  <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
    <PageHeader
      title={PAGE_TITLE}
      description="The open-source Minecraft marketplace where creators share their work."
    />

    <Reveal className="mt-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground text-sm leading-7 sm:text-base">
            VoxelVein is a free and open-source marketplace for Minecraft
            content. Maintainers upload mods, plugins, modpacks, resource packs,
            shaders, datapacks, and servers for players to discover. The
            platform was built by the community, for the community, and is
            governed by a simple set of principles.
          </p>
          <p className="text-muted-foreground mt-4 text-sm leading-7 sm:text-base">
            Publish your work, track its downloads, and reach players who care
            about what you build. Whether you make a single file or a
            full-server network, your community can find you here.
          </p>
        </div>
        <div className="grid gap-2">
          <Reveal>
            <div className="border-border/80 bg-card/60 rounded-lg border p-5">
              <p className="text-foreground text-sm font-medium">
                Free for everyone
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                No cost. No subscriptions. No ads.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="border-border/80 bg-card/60 rounded-lg border p-5">
              <p className="text-foreground text-sm font-medium">Open source</p>
              <p className="text-muted-foreground mt-1 text-xs">
                All code is on GitHub. Everyone can contribute.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="border-border/80 bg-card/60 rounded-lg border p-5">
              <p className="text-foreground text-sm font-medium">
                Community first
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Projects are community reviewed before going live.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </Reveal>

    <AboutSection
      title="Projects"
      text={[
        "Mods, plugins, modpacks, resource packs, shaders, datapacks, and servers are all projects on VoxelVein. Each one is listed, searchable, and publicly viewable.",
        "Publishers can manage their own projects, upload versions, and track downloads. Staff can review submissions and publish approved projects.",
      ]}
      action={{ label: "Browse projects", to: "/mods" }}
    />

    <AboutSection
      title="Behind the scenes"
      text={[
        "Built on TanStack Start and Drizzle ORM for the frontend and Postgres database, so the site scales cleanly and the code stays familiar to contributors.",
        "Development uses Conventional Commits, pnpm workspaces, and pnpm commands. CI runs lint, typecheck, format, build, and tests before merging anything.",
      ]}
      action={{
        label: "View on GitHub",
        to: "https://github.com/VoxelVein/frontend",
      }}
    />

    <AboutSection
      title="Get involved"
      text={[
        "Report bugs or request features in the GitHub issue tracker, with as much context as possible, and we will get to them as soon as we can.",
        "The repository's README covers how to set up a development environment, run tests, and submit pull requests. New contributors should start there.",
        "Pull requests should follow Conventional Commits and address a single feature or fix. The maintainers review and merge everything that passes CI.",
      ]}
      action={{
        label: "Open an issue",
        to: "https://github.com/VoxelVein/frontend/issues",
      }}
    />

    <Reveal className="mt-8 max-w-3xl">
      <h2 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
        How we think
      </h2>
      <p className="text-muted-foreground mt-5 text-sm leading-7 sm:text-base">
        Minecraft modding is a community sport. Admins and staff review new
        projects before they go live so the catalogue stays useful to players,
        and the project lifecycle is managed fairly for every maintainer.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Reveal delay={0.2}>
          <span className="border-border bg-muted/40 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium">
            <IconCode size={14} aria-hidden />
            Open source
          </span>
        </Reveal>
        <Reveal delay={0.3}>
          <span className="border-border bg-muted/40 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium">
            <IconPackage size={14} aria-hidden />
            Community first
          </span>
        </Reveal>
        <Reveal delay={0.4}>
          <span className="border-border bg-muted/40 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium">
            <IconTools size={14} aria-hidden />
            Quality over features
          </span>
        </Reveal>
        <Reveal delay={0.5}>
          <span className="border-border bg-muted/40 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium">
            <IconGitBranch size={14} aria-hidden />
            Transparent development
          </span>
        </Reveal>
      </div>
    </Reveal>

    <Reveal className="mt-12 max-w-3xl">
      <Link
        className={cn(
          buttonVariants({ variant: "default" }),
          "ease-smooth min-h-11 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
        )}
        preload="intent"
        to="/mods"
      >
        Browse projects
      </Link>
    </Reveal>
  </div>
);

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      {
        property: "og:url",
        content: `${SITE_URL}/about`,
      },
      {
        property: "og:title",
        content: PAGE_TITLE,
      },
      {
        name: "twitter:title",
        content: PAGE_TITLE,
      },
    ],
  }),
});
