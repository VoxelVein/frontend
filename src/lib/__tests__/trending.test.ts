import { describe, expect, it } from "vitest";

import {
  pickTrending,
  TRENDING_HALF_LIFE_DAYS,
  trendingScore,
} from "@/lib/trending";

const NOW = new Date("2026-09-27T12:00:00Z");
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_IN_MS);

describe(trendingScore, () => {
  it("halves the release boost every half-life", () => {
    const base = { downloads: 990, id: "a" };
    const fresh = trendingScore({ ...base, lastActivityAt: NOW }, NOW);
    const halfLife = trendingScore(
      { ...base, lastActivityAt: daysAgo(TRENDING_HALF_LIFE_DAYS) },
      NOW
    );
    const stale = trendingScore({ ...base, lastActivityAt: daysAgo(365) }, NOW);

    // log10(1000) = 3; boost 4 → ×5, then ×3, then ≈ ×1.
    expect(fresh).toBeCloseTo(15);
    expect(halfLife).toBeCloseTo(9);
    expect(stale).toBeCloseTo(3);
  });

  it("treats future timestamps as brand new", () => {
    const score = trendingScore(
      { downloads: 0, id: "a", lastActivityAt: daysAgo(-1) },
      NOW
    );
    expect(score).toBeCloseTo(5);
  });
});

describe(pickTrending, () => {
  it("prefers a recent release over a slightly bigger stale project", () => {
    const ids = pickTrending(
      [
        { downloads: 5000, id: "stale-big", lastActivityAt: daysAgo(90) },
        { downloads: 800, id: "fresh", lastActivityAt: daysAgo(1) },
      ],
      NOW
    );
    expect(ids).toStrictEqual(["fresh", "stale-big"]);
  });

  it("returns at most the limit, best first, ties by downloads", () => {
    const candidates = Array.from({ length: 8 }, (_, index) => ({
      downloads: index * 100,
      id: `p${index}`,
      lastActivityAt: daysAgo(30),
    }));
    expect(pickTrending(candidates, NOW, 3)).toStrictEqual(["p7", "p6", "p5"]);
    expect(pickTrending([], NOW)).toStrictEqual([]);
  });
});
