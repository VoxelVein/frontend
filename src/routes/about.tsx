import {
  IconArrowRight,
  IconBook,
  IconBrandGithub,
  IconCode,
  IconGitBranch,
  IconLicense,
  IconSearch,
  IconShieldCheck,
  IconTools,
  IconUpload,
  IconUsers,
} from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Logo } from "@/components/logo";
import { PageHeader } from "@/components/page-header";
import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { MINECRAFT_CATEGORIES, categoryLabelSentence } from "@/lib/categories";
import type { MinecraftCategory } from "@/lib/categories";
import { PROJECT_TYPE_PATHS } from "@/lib/projects";
import { staggerDelay } from "@/lib/reveal-stagger";
import { SITE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

const PAGE_TITLE = "About VoxelVein";

const REPOSITORY_URL = "https://github.com/VoxelVein/frontend";
const LICENSE_URL = `${REPOSITORY_URL}/blob/main/LICENSE`;
const README_URL = `${REPOSITORY_URL}/blob/main/README.md`;
const ISSUES_URL = `${REPOSITORY_URL}/issues`;
const PULL_REQUEST_URL = `${REPOSITORY_URL}/compare`;

/**
 * The project types, read from the category registry rather than listed here,
 * so a category added to the site can never go unmentioned on this page.
 */
const TYPE_SENTENCE = categoryLabelSentence();

/**
 * Shared lift-and-press motion for every call to action on the page.
 *
 * `buttonVariants` carries the colour, border and focus treatment; this adds
 * the pointer feedback and respects reduced motion.
 */
const CTA_CLASS =
  "ease-smooth min-h-11 transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none";

interface StatCardProps {
  description: string;
  icon: Icon;
  label: string;
}

const StatCard = ({ description, icon: Icon, label }: StatCardProps) => (
  <Card size="sm">
    <CardContent>
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon aria-hidden="true" size={18} stroke={1.7} />
        </div>
        <div className="min-w-0">
          <p className="text-foreground text-sm font-semibold">{label}</p>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            {description}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const STATS: readonly StatCardProps[] = [
  {
    description: "No subscriptions, ads, or paid tiers.",
    icon: IconLicense,
    label: "Free for everyone",
  },
  {
    description: "The full source is public on GitHub.",
    icon: IconCode,
    label: "Apache 2.0",
  },
  {
    description: "Staff review projects before they go live.",
    icon: IconShieldCheck,
    label: "Community reviewed",
  },
];

const CategoryCard = ({ category }: { category: MinecraftCategory }) => {
  const Icon = category.icon;

  return (
    <Link
      className="group focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:outline-none"
      preload="intent"
      to={category.href}
    >
      <Card>
        <CardContent>
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 motion-reduce:transition-none">
              <Icon aria-hidden="true" size={22} stroke={1.7} />
            </div>
            <div className="min-w-0">
              <h3 className="text-foreground group-hover:text-primary text-base font-semibold tracking-tight transition-colors duration-200 motion-reduce:transition-none">
                {category.label}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm leading-6">
                {category.description}
              </p>
            </div>
            <IconArrowRight
              aria-hidden="true"
              className="text-muted-foreground group-hover:text-primary mt-0.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
              size={16}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

interface StepProps {
  description: string;
  icon: Icon;
  title: string;
}

const STEPS: readonly StepProps[] = [
  {
    description:
      "Creators upload a project, its versions, and the details players need to install it.",
    icon: IconUpload,
    title: "Publish",
  },
  {
    description:
      "Staff check submissions for completeness and quality before approving them.",
    icon: IconShieldCheck,
    title: "Review",
  },
  {
    description:
      "Approved projects appear in browse, search, and trending, ready for players.",
    icon: IconSearch,
    title: "Discover",
  },
];

const StepCard = ({ index, step }: { index: number; step: StepProps }) => {
  const Icon = step.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="bg-primary text-primary-foreground inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
            {index + 1}
          </span>
          <Icon aria-hidden="true" className="text-primary" size={20} />
        </div>
        <h3 className="text-foreground text-base font-semibold tracking-tight">
          {step.title}
        </h3>
        <CardDescription>{step.description}</CardDescription>
      </CardHeader>
    </Card>
  );
};

interface PrincipleProps {
  description: string;
  icon: Icon;
  title: string;
}

const PRINCIPLES: readonly PrincipleProps[] = [
  {
    description:
      "Every line of the frontend is public on GitHub. Anyone can inspect it, fork it, and contribute.",
    icon: IconCode,
    title: "Open source",
  },
  {
    description:
      "Staff review projects before they go live, so the catalogue stays useful to players.",
    icon: IconUsers,
    title: "Community first",
  },
  {
    description:
      "We ship deliberate improvements rather than piling on surface area.",
    icon: IconTools,
    title: "Quality over features",
  },
  {
    description:
      "Roadmap, issues, and pull requests are discussed in the open.",
    icon: IconGitBranch,
    title: "Transparent development",
  },
];

const PrincipleCard = ({ principle }: { principle: PrincipleProps }) => {
  const Icon = principle.icon;

  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-2">
          <Icon aria-hidden="true" className="text-primary" size={18} />
          <h3 className="text-foreground text-sm font-semibold">
            {principle.title}
          </h3>
        </div>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          {principle.description}
        </p>
      </CardContent>
    </Card>
  );
};

interface InvolvementProps {
  description: string;
  href: string;
  icon: Icon;
  label: string;
}

const INVOLVEMENT: readonly InvolvementProps[] = [
  {
    description:
      "Report bugs or request features with as much context as you can.",
    href: ISSUES_URL,
    icon: IconBrandGithub,
    label: "Open an issue",
  },
  {
    description:
      "Set up a development environment, run the suite, and learn the commands.",
    href: README_URL,
    icon: IconBook,
    label: "Read the README",
  },
  {
    description:
      "Send a focused change that follows Conventional Commits and passes CI.",
    href: PULL_REQUEST_URL,
    icon: IconGitBranch,
    label: "Open a pull request",
  },
];

const InvolvementCard = ({ action }: { action: InvolvementProps }) => {
  const Icon = action.icon;

  return (
    <a
      aria-label={action.label}
      className="group focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:outline-none"
      href={action.href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <Card>
        <CardContent>
          <div className="flex items-center gap-2">
            <Icon aria-hidden="true" className="text-primary" size={18} />
            <h3 className="text-foreground text-sm font-semibold">
              {action.label}
            </h3>
          </div>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            {action.description}
          </p>
          <span className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-medium">
            Open
            <IconArrowRight
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
              size={16}
            />
          </span>
        </CardContent>
      </Card>
    </a>
  );
};

const AboutPage = () => (
  <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
    <PageHeader
      title={PAGE_TITLE}
      description="What VoxelVein is, how a project reaches players, and how to get involved."
      action={
        <div className="flex flex-wrap gap-2">
          <Link
            className={cn(buttonVariants({ variant: "default" }), CTA_CLASS)}
            preload="intent"
            to={PROJECT_TYPE_PATHS.mod}
          >
            Browse projects
            <IconArrowRight aria-hidden="true" />
          </Link>
          <a
            className={cn(buttonVariants({ variant: "outline" }), CTA_CLASS)}
            href={REPOSITORY_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <IconBrandGithub aria-hidden="true" />
            View on GitHub
          </a>
        </div>
      }
    />

    <section aria-labelledby="about-story-heading" className="mt-10">
      <Reveal>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                <Logo className="text-primary size-10" />
                <a
                  aria-label="Apache 2.0 license"
                  className="focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                  href={LICENSE_URL}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Badge variant="outline">
                    <IconLicense aria-hidden="true" />
                    Apache 2.0
                  </Badge>
                </a>
                <Badge variant="outline">
                  <IconCode aria-hidden="true" />
                  Open source
                </Badge>
              </div>
              <h2
                className="text-foreground mt-4 text-2xl font-bold tracking-tight text-balance sm:text-3xl"
                id="about-story-heading"
              >
                Built by the community, for the community.
              </h2>
              <p className="text-muted-foreground mt-3 text-sm leading-7 sm:text-base">
                VoxelVein is a free, open-source home for {TYPE_SENTENCE}.
                Creators publish their work, track downloads, and reach players
                who care about what they build, whether it is a single file or a
                full-server network.
              </p>
              <p className="text-muted-foreground mt-3 text-sm leading-7 sm:text-base">
                The platform is governed by a simple set of principles: keep it
                free, keep it open, and keep the catalogue useful.
              </p>
            </CardContent>
          </Card>

          <ul aria-label="At a glance" className="grid gap-3">
            {STATS.map((stat, index) => (
              <li key={stat.label}>
                <Reveal delay={staggerDelay(index)}>
                  <StatCard {...stat} />
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>

    <section aria-labelledby="about-projects-heading" className="mt-12">
      <Reveal className="max-w-2xl">
        <h2
          className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl"
          id="about-projects-heading"
        >
          What you can publish
        </h2>
        <p className="text-muted-foreground mt-3 text-sm leading-7 sm:text-base">
          {MINECRAFT_CATEGORIES.length} project types, each listed, searchable,
          and publicly viewable.
        </p>
      </Reveal>

      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MINECRAFT_CATEGORIES.map((category, index) => (
          <li key={category.href}>
            <Reveal delay={staggerDelay(index)}>
              <CategoryCard category={category} />
            </Reveal>
          </li>
        ))}
      </ul>
    </section>

    <section aria-labelledby="about-process-heading" className="mt-12">
      <Reveal className="max-w-2xl">
        <h2
          className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl"
          id="about-process-heading"
        >
          How a project reaches players
        </h2>
        <p className="text-muted-foreground mt-3 text-sm leading-7 sm:text-base">
          Every project follows the same path, from upload to approval to
          discovery.
        </p>
      </Reveal>

      <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, index) => (
          <li className="h-full" key={step.title}>
            <Reveal className="h-full" delay={staggerDelay(index)}>
              <StepCard index={index} step={step} />
            </Reveal>
          </li>
        ))}
      </ol>
    </section>

    <section aria-labelledby="about-principles-heading" className="mt-12">
      <Reveal className="max-w-2xl">
        <h2
          className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl"
          id="about-principles-heading"
        >
          What we believe
        </h2>
        <p className="text-muted-foreground mt-3 text-sm leading-7 sm:text-base">
          Four principles shape how the platform is built and run.
        </p>
      </Reveal>

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PRINCIPLES.map((principle, index) => (
          <li className="h-full" key={principle.title}>
            <Reveal className="h-full" delay={staggerDelay(index)}>
              <PrincipleCard principle={principle} />
            </Reveal>
          </li>
        ))}
      </ul>
    </section>

    <section aria-labelledby="about-stack-heading" className="mt-12">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Reveal>
          <h2
            className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl"
            id="about-stack-heading"
          >
            Behind the scenes
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-7 sm:text-base">
            Built on TanStack Start and Drizzle ORM for the frontend and
            Postgres for storage, so the site scales cleanly and the code stays
            familiar to contributors.
          </p>
          <p className="text-muted-foreground mt-3 text-sm leading-7 sm:text-base">
            Development uses Conventional Commits, pnpm workspaces, and pnpm
            commands. CI runs lint, typecheck, format, build, and tests before
            anything merges.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <Card size="sm">
            <CardHeader>
              <h3 className="text-foreground text-sm font-semibold">
                The stack
              </h3>
              <CardDescription>
                Tools the project runs on, and the rules contributors follow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul
                aria-label="Technology and conventions"
                className="flex flex-wrap gap-2"
              >
                {[
                  "TanStack Start",
                  "Drizzle ORM",
                  "Postgres",
                  "Conventional Commits",
                  "pnpm",
                  "CI",
                ].map((item) => (
                  <li key={item}>
                    <Badge variant="outline">{item}</Badge>
                  </li>
                ))}
              </ul>
              <a
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  CTA_CLASS,
                  "mt-3"
                )}
                href={REPOSITORY_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                <IconBrandGithub aria-hidden="true" />
                Explore the repository
              </a>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </section>

    <section aria-labelledby="about-involvement-heading" className="mt-12">
      <Reveal className="max-w-2xl">
        <h2
          className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl"
          id="about-involvement-heading"
        >
          Get involved
        </h2>
        <p className="text-muted-foreground mt-3 text-sm leading-7 sm:text-base">
          The repository is open to bug reports, documentation fixes, and
          focused pull requests.
        </p>
      </Reveal>

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INVOLVEMENT.map((action, index) => (
          <li className="h-full" key={action.label}>
            <Reveal className="h-full" delay={staggerDelay(index)}>
              <InvolvementCard action={action} />
            </Reveal>
          </li>
        ))}
      </ul>
    </section>

    <section aria-labelledby="about-publish-heading" className="mt-12">
      <Reveal>
        <div className="border-primary/20 bg-primary/5 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-6 sm:p-8">
          <div className="max-w-xl">
            <h2
              className="text-foreground text-xl font-bold tracking-tight sm:text-2xl"
              id="about-publish-heading"
            >
              Publish your work
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-7 sm:text-base">
              Create an account to upload versions, manage projects, and track
              downloads.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className={cn(buttonVariants({ variant: "default" }), CTA_CLASS)}
              preload="intent"
              to="/signup"
            >
              Create an account
            </Link>
            <Link
              className={cn(buttonVariants({ variant: "outline" }), CTA_CLASS)}
              preload="intent"
              to={PROJECT_TYPE_PATHS.mod}
            >
              Browse projects
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
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
