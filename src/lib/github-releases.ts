/* oxlint-disable anti-slop/no-unknown-parameters -- GitHub's JSON is narrowed with Valibot inside this function; `unknown` is the boundary type, not a leaked contract. */
import { array, boolean, nullish, object, safeParse, string } from "valibot";

/**
 * The public changelog reads GitHub releases, not the repository's Markdown
 * file, so a published release and the page can never describe different
 * versions. The API response is untrusted input: it is narrowed through Valibot
 * before anything reaches a component.
 */

export const GITHUB_REPOSITORY = "VoxelVein/frontend";

/** `per_page=100` keeps the timeline complete without following a Link header. */
export const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPOSITORY}/releases?per_page=100`;

/** One release as the changelog needs it, with nothing the UI cannot use. */
export interface ReleaseView {
  /** Markdown release notes, sanitized at render time. */
  body: string;
  /** Canonical release page, for the "View on GitHub" link. */
  htmlUrl: string;
  /** Display name, falling back to the tag when GitHub has no title. */
  name: string;
  /** ISO instant, falling back to creation time for an unpublishable draft. */
  publishedAt: string;
  /** Git tag, used for anchors and milestones. */
  tag: string;
}

/**
 * Only the fields actually consumed are described. GitHub sends much more, and
 * Valibot's object schema ignores unknown keys, so an upstream addition cannot
 * quietly change what the page renders.
 */
const releaseSchema = object({
  body: nullish(string()),
  created_at: string(),
  draft: boolean(),
  html_url: string(),
  name: nullish(string()),
  published_at: nullish(string()),
  tag_name: string(),
});

const releasesSchema = array(releaseSchema);

/** Newest first, with an invalid upstream timestamp sorting last rather than NaN. */
const publishedTime = (release: ReleaseView): number =>
  Date.parse(release.publishedAt) || 0;

/**
 * Validates and shapes an API payload into releases the page can render.
 *
 * Drafts are dropped even when a token makes GitHub return them: a changelog
 * must not announce a release that is still being written. Sorting is done here
 * rather than relying on API order, so the timeline is stable if the endpoint
 * changes its default ordering.
 */
export const parseGithubReleases = (data: unknown): ReleaseView[] => {
  const result = safeParse(releasesSchema, data);

  if (!result.success) {
    throw new Error("GitHub returned an unexpected release format.");
  }

  const releases: ReleaseView[] = [];

  for (const release of result.output) {
    if (release.draft) {
      continue;
    }

    releases.push({
      body: release.body ?? "",
      htmlUrl: release.html_url,
      name: release.name?.trim() || release.tag_name,
      publishedAt: release.published_at ?? release.created_at,
      tag: release.tag_name,
    });
  }

  return releases.toSorted(
    (left, right) => publishedTime(right) - publishedTime(left)
  );
};
