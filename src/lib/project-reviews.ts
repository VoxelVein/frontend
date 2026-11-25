/**
 * Rules for player reviews, shared by the database schema, the server
 * functions and the UI.
 *
 * Projects can only be reviewed by someone who has actually fetched their
 * files, and only once the download has had time to finish. Servers have no
 * files to fetch, so a visitor who has played one can review it directly.
 */

/** Query keys shared by the review panel and the download links that unlock it. */
export const REVIEW_STATUS_QUERY_KEY = "project-review-status";
export const REVIEW_LISTING_QUERY_KEY = "project-review-listing";

/** Sent by download links; the review panel then refreshes its eligibility. */
export const PROJECT_DOWNLOADED_EVENT = "voxelvein:project-downloaded";

/** Delay before that refresh, so the download endpoint can record the fetch. */
export const REVIEW_REFRESH_DELAY_MS = 1500;

/** The whole rating scale, also used to validate input at the HTTP boundary. */
export const REVIEW_RATINGS = [1, 2, 3, 4, 5] as const;

export type ReviewRating = (typeof REVIEW_RATINGS)[number];

/** Reviews are a short note, not a second description of the project. */
export const REVIEW_COMMENT_MAX_LENGTH = 300;

/** How long a download must sit before it can be reviewed. */
export const REVIEW_AFTER_DOWNLOAD_MS = 5000;

export type ReviewEligibilityReason =
  | "eligible"
  | "sign-in"
  | "verify-email"
  | "already-reviewed"
  | "download-required"
  | "cooldown"
  | "unavailable";

export interface ReviewEligibilityInput {
  /** The account's most recent download, or null when it has never downloaded. */
  downloadedAt: Date | null;
  emailVerified: boolean;
  hasReviewed: boolean;
  /** Servers skip the download gate entirely. */
  kind: "project" | "server";
  signedIn: boolean;
}

export interface ReviewEligibility {
  /** ISO instant a recorded download clears the gate, for a short countdown. */
  downloadReadyAt: string | null;
  eligible: boolean;
  reason: ReviewEligibilityReason;
}

/** What each refusal looks like to the reader, in one place for UI and errors. */
export const REVIEW_MESSAGES: Record<
  Exclude<ReviewEligibilityReason, "eligible">,
  string
> = {
  "sign-in": "Sign in to leave a review.",
  "verify-email": "Verify your email before leaving a review.",
  "already-reviewed": "You have already reviewed this.",
  "download-required": "Download this project before leaving a review.",
  cooldown: "You can review this 5 seconds after downloading it.",
  unavailable: "This project is unavailable.",
};

/** Refusals have a reader-facing message; "eligible" has none. */
export const refusalMessage = (
  reason: ReviewEligibilityReason
): string | null => (reason === "eligible" ? null : REVIEW_MESSAGES[reason]);

/** The instant a download becomes old enough to review. */
export const downloadReadyAt = (downloadedAt: Date | null): Date | null =>
  downloadedAt === null
    ? null
    : new Date(downloadedAt.getTime() + REVIEW_AFTER_DOWNLOAD_MS);

/**
 * The single eligibility decision, used both to render the form and to re-check
 * the submission server-side. A UI-only check would be nothing at all, and a
 * server-only check would leave visitors staring at a form they cannot submit.
 */
export const reviewEligibility = (
  input: ReviewEligibilityInput,
  now: Date = new Date()
): ReviewEligibility => {
  const readyAt = downloadReadyAt(input.downloadedAt);

  const decide = (reason: ReviewEligibilityReason): ReviewEligibility => ({
    downloadReadyAt: readyAt?.toISOString() ?? null,
    eligible: reason === "eligible",
    reason,
  });

  if (!input.signedIn) {
    return decide("sign-in");
  }

  if (!input.emailVerified) {
    return decide("verify-email");
  }

  if (input.hasReviewed) {
    return decide("already-reviewed");
  }

  if (input.kind === "server") {
    return decide("eligible");
  }

  if (!readyAt) {
    return decide("download-required");
  }

  if (readyAt.getTime() > now.getTime()) {
    return decide("cooldown");
  }

  return decide("eligible");
};
