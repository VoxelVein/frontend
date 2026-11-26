import {
  IconAlertTriangle,
  IconExternalLink,
  IconFlag,
  IconHistory,
  IconRocket,
} from "@tabler/icons-react";
import { useState } from "react";

import { MarkdownBody } from "@/components/markdown-body";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  categoryCounts,
  CHANGELOG_CATEGORIES,
  milestonesFor,
  releaseAnchor,
  releaseCategories,
  releaseNotes,
  releasesInCategory,
} from "@/lib/changelog";
import type {
  ChangelogCategory,
  ChangelogMilestone,
  MilestoneKind,
} from "@/lib/changelog";
import { formatDate } from "@/lib/format";
import type { ReleaseView } from "@/lib/github-releases";

interface ReleaseTimelineProps {
  /** Newest first, as returned by the releases client. */
  releases: readonly ReleaseView[];
}

/** Upstream timestamps are strings, so a malformed one must not render as NaN. */
const dateLabel = (value: string): string =>
  Number.isNaN(Date.parse(value)) ? "Date unknown" : formatDate(value);

const categoryLabel = (category: ChangelogCategory): string =>
  CHANGELOG_CATEGORIES.find((entry) => entry.value === category)?.label ??
  category;

/** The button's accessible name states what the count means, in words. */
const filterLabel = (label: string, count: number): string =>
  `${label}, ${count} ${count === 1 ? "release" : "releases"}`;

const MILESTONE_ICONS: Record<MilestoneKind, typeof IconFlag> = {
  "alpha-prefix": IconFlag,
  breaking: IconAlertTriangle,
  "major-version": IconRocket,
};

const milestoneIcon = (kind: MilestoneKind) => {
  const Icon = MILESTONE_ICONS[kind];

  return <Icon size={12} aria-hidden="true" />;
};

/** An outlined dot for an ordinary release, a ringed one for a milestone. */
const TimelineDot = ({ milestone }: { milestone?: ChangelogMilestone }) => (
  <span
    aria-hidden="true"
    className={
      milestone
        ? "border-background bg-foreground ring-foreground/15 [&>svg]:text-background absolute top-2 left-0 flex size-4 -translate-x-1/2 items-center justify-center rounded-full border-2 ring-4"
        : "border-background bg-muted-foreground absolute top-2.5 left-0 size-3 -translate-x-1/2 rounded-full border-2"
    }
  >
    {milestone ? milestoneIcon(milestone.kind) : null}
  </span>
);

/** A compact index beside the timeline, following the same filtered list. */
const ReleaseIndex = ({ releases }: { releases: readonly ReleaseView[] }) => (
  <nav aria-label="Jump to a release" className="lg:sticky lg:top-6">
    <h2 className="text-sm font-semibold">Releases</h2>
    <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col">
      {releases.map((release) => (
        <li key={release.tag}>
          <a
            className="focus-visible:ring-ring text-muted-foreground hover:text-foreground hover:bg-muted inline-flex min-h-9 items-center rounded-md px-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
            href={`#${releaseAnchor(release.tag)}`}
          >
            {release.tag}
          </a>
        </li>
      ))}
    </ul>
  </nav>
);

/**
 * A vertical release history with three jobs: show what shipped, let readers
 * jump to a version, and make the releases that changed direction visible at a
 * glance. Categories come from the notes themselves, so the filter cannot
 * disagree with what a release actually contains.
 */
export const ReleaseTimeline = ({ releases }: ReleaseTimelineProps) => {
  const [activeCategory, setActiveCategory] =
    useState<ChangelogCategory | null>(null);

  const counts = categoryCounts(releases);
  const milestones = milestonesFor(releases);
  const visible = releasesInCategory(releases, activeCategory);

  return (
    <section aria-labelledby="release-history-heading" id="changelog-top">
      <h2 className="sr-only" id="release-history-heading">
        Release history
      </h2>

      <fieldset>
        <legend className="sr-only">Filter releases by category</legend>
        <div className="flex flex-wrap gap-2">
          <Button
            aria-label={filterLabel("All releases", releases.length)}
            aria-pressed={activeCategory === null}
            onClick={() => {
              setActiveCategory(null);
            }}
            size="lg"
            variant={activeCategory === null ? "default" : "outline"}
          >
            All releases
          </Button>
          {CHANGELOG_CATEGORIES.map((category) => (
            <Button
              aria-label={filterLabel(category.label, counts[category.value])}
              aria-pressed={activeCategory === category.value}
              key={category.value}
              onClick={() => {
                setActiveCategory(category.value);
              }}
              size="lg"
              variant={
                activeCategory === category.value ? "default" : "outline"
              }
            >
              {category.label}
              <span
                aria-hidden="true"
                className="text-xs tabular-nums opacity-70"
              >
                {counts[category.value]}
              </span>
            </Button>
          ))}
        </div>
      </fieldset>

      {/* Filtering does not navigate, so the changing count is the one thing a
          screen reader would otherwise never be told about. */}
      <p aria-live="polite" className="sr-only">
        {visible.length} {visible.length === 1 ? "release" : "releases"}
      </p>

      {visible.length === 0 ? (
        <div className="border-border bg-muted/40 mt-8 rounded-xl border p-6 text-center">
          <div className="border-border bg-background text-muted-foreground mx-auto mb-3 flex size-11 items-center justify-center rounded-xl border">
            <IconHistory size={20} aria-hidden="true" />
          </div>
          <p className="text-foreground text-sm font-medium">
            {releases.length === 0
              ? "No releases yet"
              : "No releases in this category"}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {releases.length === 0
              ? "Published releases will appear here."
              : "Try another category or show every release."}
          </p>
          {releases.length > 0 ? (
            <div className="mt-4">
              <Button
                onClick={() => {
                  setActiveCategory(null);
                }}
                size="sm"
                variant="outline"
              >
                Show all releases
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-10 grid gap-10 lg:grid-cols-[12rem_minmax(0,1fr)]">
            <ReleaseIndex releases={visible} />

            <ol className="border-border ml-2 border-l">
              {visible.map((release) => {
                const milestone = milestones.get(release.tag);
                const categories = releaseCategories(release.body);

                return (
                  <li
                    className="relative scroll-mt-24 pb-12 pl-7 last:pb-0"
                    id={releaseAnchor(release.tag)}
                    key={release.tag}
                  >
                    <TimelineDot milestone={milestone} />

                    <article
                      aria-labelledby={`heading-${releaseAnchor(release.tag)}`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <h3
                          className="text-foreground text-xl font-semibold tracking-tight"
                          id={`heading-${releaseAnchor(release.tag)}`}
                        >
                          {release.name}
                        </h3>
                        <time
                          className="text-muted-foreground text-sm"
                          dateTime={release.publishedAt}
                        >
                          {dateLabel(release.publishedAt)}
                        </time>
                      </div>

                      <p className="text-muted-foreground mt-1 font-mono text-xs">
                        {release.tag}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {milestone ? (
                          <Badge variant="default">
                            {milestoneIcon(milestone.kind)}
                            {milestone.label}
                          </Badge>
                        ) : null}
                        {categories.map((category) => (
                          <Badge key={category} variant="secondary">
                            {categoryLabel(category)}
                          </Badge>
                        ))}
                        <a
                          aria-label={`View ${release.tag} on GitHub`}
                          className="focus-visible:ring-ring text-muted-foreground hover:text-foreground inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
                          href={release.htmlUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          View on GitHub
                          <IconExternalLink size={12} aria-hidden="true" />
                        </a>
                      </div>

                      {release.body.trim() === "" ? null : (
                        <div className="markdown-body mt-5 text-sm">
                          <MarkdownBody>
                            {releaseNotes(release.body, release.tag)}
                          </MarkdownBody>
                        </div>
                      )}
                    </article>
                  </li>
                );
              })}
            </ol>
          </div>

          <a
            className="focus-visible:ring-ring text-muted-foreground hover:text-foreground mt-8 inline-flex min-h-9 items-center rounded-md text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
            href="#changelog-top"
          >
            Back to top
          </a>
        </>
      )}
    </section>
  );
};
