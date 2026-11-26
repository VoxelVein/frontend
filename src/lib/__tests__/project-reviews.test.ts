import { describe, expect, it } from "vitest";

import {
  downloadReadyAt,
  REVIEW_AFTER_DOWNLOAD_MS,
  reviewEligibility,
} from "@/lib/project-reviews";
import type { ReviewEligibilityInput } from "@/lib/project-reviews";

const account = (
  overrides: Partial<ReviewEligibilityInput> = {}
): ReviewEligibilityInput => ({
  downloadedAt: null,
  emailVerified: true,
  hasReviewed: false,
  kind: "project",
  signedIn: true,
  ...overrides,
});

describe("review eligibility", () => {
  it("opens the gate exactly five seconds after a download", () => {
    const downloadedAt = new Date("2026-01-01T00:00:00.000Z");

    expect(downloadReadyAt(downloadedAt)?.toISOString()).toBe(
      "2026-01-01T00:00:05.000Z"
    );
    expect(downloadReadyAt(null)).toBeNull();
    expect(
      reviewEligibility(
        account({ downloadedAt }),
        new Date("2026-01-01T00:00:04.999Z")
      ).reason
    ).toBe("cooldown");
    expect(
      reviewEligibility(
        account({ downloadedAt }),
        new Date("2026-01-01T00:00:05.000Z")
      ).eligible
    ).toBeTruthy();
  });

  it("refuses a project that was never downloaded", () => {
    expect(reviewEligibility(account())).toMatchObject({
      eligible: false,
      reason: "download-required",
    });
  });

  it("lets a server be reviewed without a download", () => {
    expect(
      reviewEligibility(account({ downloadedAt: null, kind: "server" }))
    ).toMatchObject({ eligible: true, reason: "eligible" });
  });

  it("reports the ready instant while the download is too new", () => {
    const downloadedAt = new Date("2026-01-01T00:00:00.000Z");

    const status = reviewEligibility(
      account({ downloadedAt }),
      new Date("2026-01-01T00:00:01.000Z")
    );

    expect(status.downloadReadyAt).toBe("2026-01-01T00:00:05.000Z");
    expect(status.reason).toBe("cooldown");
  });

  it("asks visitors to sign in before deciding about downloads", () => {
    expect(
      reviewEligibility(account({ downloadedAt: null, signedIn: false }))
    ).toMatchObject({ eligible: false, reason: "sign-in" });
  });

  it("asks for a verified email before reviewing", () => {
    expect(
      reviewEligibility(
        account({
          downloadedAt: new Date(Date.now() - REVIEW_AFTER_DOWNLOAD_MS - 1),
          emailVerified: false,
        })
      )
    ).toMatchObject({ eligible: false, reason: "verify-email" });
  });

  it("does not offer a second review to the same account", () => {
    expect(
      reviewEligibility(
        account({
          downloadedAt: new Date(Date.now() - REVIEW_AFTER_DOWNLOAD_MS - 1),
          hasReviewed: true,
        })
      )
    ).toMatchObject({ eligible: false, reason: "already-reviewed" });
  });

  it("never places a reviewed account back into a cooldown", () => {
    expect(
      reviewEligibility(account({ hasReviewed: true, kind: "server" }))
    ).toMatchObject({ eligible: false, reason: "already-reviewed" });
  });
});
