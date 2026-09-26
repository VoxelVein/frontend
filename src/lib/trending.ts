/**
 * Trending score for the home page. Downloads are only stored as running
 * totals, so "trending" means popular and recently active: popularity grows
 * with the logarithm of downloads (so one giant project cannot hold every
 * slot), and a fresh release multiplies it by up to five, halving every
 * three days.
 */

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** How fast the boost from a new release fades. */
export const TRENDING_HALF_LIFE_DAYS = 3;

/** Multiplier on top of popularity for a release made right now. */
const MAX_RELEASE_BOOST = 4;

/** Keeps brand-new projects (zero downloads) in the running. */
const DOWNLOAD_PRIOR = 10;

export const TRENDING_LIMIT = 5;

export interface TrendingCandidate {
  downloads: number;
  id: string;
  /** Newest version upload, or the publish date when there is none. */
  lastActivityAt: Date;
}

export const trendingScore = (
  { downloads, lastActivityAt }: TrendingCandidate,
  now: Date
): number => {
  const ageDays =
    Math.max(0, now.getTime() - lastActivityAt.getTime()) / DAY_IN_MS;
  const releaseBoost =
    MAX_RELEASE_BOOST * 0.5 ** (ageDays / TRENDING_HALF_LIFE_DAYS);
  const popularity = Math.log10(Math.max(0, downloads) + DOWNLOAD_PRIOR);
  return popularity * (1 + releaseBoost);
};

interface Ranked {
  candidate: TrendingCandidate;
  score: number;
}

const ranksAbove = (a: Ranked, b: Ranked): boolean =>
  a.score > b.score ||
  (a.score === b.score && a.candidate.downloads > b.candidate.downloads);

/**
 * Ids of the top candidates, best first. Ties go to more downloads. Keeps a
 * short ranked list instead of sorting every published project.
 */
export const pickTrending = (
  candidates: TrendingCandidate[],
  now: Date,
  limit: number = TRENDING_LIMIT
): string[] => {
  const top: Ranked[] = [];
  for (const candidate of candidates) {
    const entry = { candidate, score: trendingScore(candidate, now) };
    const index = top.findIndex((existing) => ranksAbove(entry, existing));
    if (index === -1) {
      if (top.length < limit) {
        top.push(entry);
      }
      continue;
    }
    top.splice(index, 0, entry);
    if (top.length > limit) {
      top.pop();
    }
  }
  return top.map(({ candidate }) => candidate.id);
};
