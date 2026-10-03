import { describe, expect, it } from "vitest";

import { needsReview } from "@/lib/publication-rule";

const PAST = "2026-01-15T10:30:00.000Z";

describe(needsReview, () => {
  it("sends a first publication to the queue", () => {
    // Never been live, so nobody has judged it and a moderator should.
    expect(needsReview({ publishedAt: null, takenDownAt: null })).toBeTruthy();
  });

  it("lets an owner republish something they unpublished themselves", () => {
    // The rule the request asked for. Withdrawing your own listing is not a
    // moderation event, and making someone queue to undo their own decision puts
    // the review step in charge of a self-service action.
    expect(needsReview({ publishedAt: PAST, takenDownAt: null })).toBeFalsy();
  });

  it("still queues a project staff took down, however old the approval was", () => {
    // The exception, and it overrides the history: putting it back up is exactly
    // what that judgement was for.
    expect(needsReview({ publishedAt: PAST, takenDownAt: PAST })).toBeTruthy();
  });

  it("queues a taken-down project that has never been published", () => {
    expect(needsReview({ publishedAt: null, takenDownAt: PAST })).toBeTruthy();
  });

  it("accepts dates as well as strings", () => {
    // The column comes back as a `Date` from some paths and an ISO string from
    // others; the rule must not care which.
    expect(
      needsReview({ publishedAt: new Date(PAST), takenDownAt: null })
    ).toBeFalsy();
    expect(
      needsReview({ publishedAt: new Date(PAST), takenDownAt: new Date(PAST) })
    ).toBeTruthy();
  });

  it("is decided by presence rather than by the value", () => {
    // A takedown from a year ago still counts; a publication from a decade ago
    // still counts as "was live".
    expect(
      needsReview({
        publishedAt: "2016-01-01T00:00:00.000Z",
        takenDownAt: "2026-01-01T00:00:00.000Z",
      })
    ).toBeTruthy();
    expect(
      needsReview({
        publishedAt: "2016-01-01T00:00:00.000Z",
        takenDownAt: null,
      })
    ).toBeFalsy();
  });
});
