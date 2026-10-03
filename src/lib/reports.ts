import { maxLength, object, optional, picklist, pipe, string } from "valibot";

/**
 * What can be reported, and what a report says about it.
 *
 * Kept out of `db/schema.ts` so the client can render the reason list without
 * pulling the database in, the way `POST_CATEGORIES` and `PROJECT_STATUS` work.
 */

/**
 * The two kinds of thing a member can report.
 *
 * The values are written out as the tuple and the labels derived from it, not
 * the other way round: valibot's `picklist` needs a literal tuple, and building
 * one with `.map()` produces a plain array that types as `string[]` and loses the
 * narrowing. Keeping the values primary also means a value cannot drift out of
 * sync with a label, because the label table is typed against them.
 */
const TARGET_VALUES = ["project", "user"] as const;

export type ReportTarget = (typeof TARGET_VALUES)[number];

export const REPORT_TARGETS = [
  { label: "a project", value: "project" },
  { label: "a user", value: "user" },
] as const satisfies readonly { label: string; value: ReportTarget }[];

/**
 * Why something is being reported.
 *
 * A closed list rather than free text, so an inbox can be triaged by reason and
 * so "something else" stays a visible bucket instead of a dumping ground. The
 * reporter adds prose in `details` either way.
 */
const REASON_VALUES = [
  "spam",
  "harassment",
  "malware",
  "copyright",
  "hate",
  "low-quality",
  "other",
] as const;

export type ReportReason = (typeof REASON_VALUES)[number];

export const REPORT_REASONS = [
  { label: "Spam or advertising", value: "spam" },
  { label: "Harassment or abuse", value: "harassment" },
  { label: "Malware or malicious download", value: "malware" },
  { label: "Copyright infringement", value: "copyright" },
  { label: "Hate speech", value: "hate" },
  { label: "Off-topic or low quality", value: "low-quality" },
  { label: "Something else", value: "other" },
] as const satisfies readonly { label: string; value: ReportReason }[];

/** Bounds the free text a reporter can add. */
export const REPORT_DETAILS_MAX_LENGTH = 2000;

/**
 * How a report left the inbox.
 *
 * `resolved` means something was done about it; `dismissed` means a moderator
 * looked and disagreed. They are kept apart because "nobody did anything" and
 * "we decided this was fine" are very different answers to "is this site
 * policed?", and collapsing them loses the second one.
 */
export const REPORT_RESOLUTIONS = ["resolved", "dismissed"] as const;

export type ReportResolution = (typeof REPORT_RESOLUTIONS)[number];

const RESOLUTION_VALUES: readonly ReportResolution[] = REPORT_RESOLUTIONS;

export type ReportStatus = ReportResolution | "open";

const reportReasonLabel = (value: string): string =>
  REPORT_REASONS.find((reason) => reason.value === value)?.label ?? value;

const reportTargetLabel = (value: string): string =>
  REPORT_TARGETS.find((target) => target.value === value)?.label ?? value;

/**
 * Narrows a stored `reason` column to a reason the UI knows.
 *
 * An unrecognised value falls back to `other`, which keeps it visible in the
 * inbox and honest about needing a human to read it, rather than rendering a
 * blank chip for a reason nobody can see.
 */
const isReportReason = (value: string): value is ReportReason =>
  REASON_VALUES.some((reason) => reason === value);

const toReportReason = (value: string): ReportReason =>
  isReportReason(value) ? value : "other";

/**
 * Narrows a stored `status` column to the three states there are.
 *
 * The column is `text`, so drizzle types it as a bare `string`; an unknown value
 * is treated as open rather than trusted, because an inbox that hid a report it
 * did not recognise would look like the report had been dealt with.
 */
const toReportStatus = (value: string | null): ReportStatus => {
  if (value === "resolved" || value === "dismissed") {
    return value;
  }
  return "open";
};

/**
 * Narrows a stored `target_kind` column.
 *
 * An unrecognised kind is read as `project`, which is the more conservative of
 * the two mistakes: it points the moderator at a project instead of at a person,
 * and a mis-targeted row is visible and correctable rather than a report about
 * an account that never existed.
 */
const toReportTarget = (value: string): ReportTarget =>
  value === "user" ? "user" : "project";

const isReportResolution = (value: string): value is ReportResolution =>
  RESOLUTION_VALUES.some((resolution) => resolution === value);

/** The resolution a status names, or null while the report is still open. */
const toReportResolution = (value: string | null): ReportResolution | null => {
  if (value === null || !isReportResolution(value)) {
    return null;
  }
  return value;
};

/** Trims the free text, collapsing an all-whitespace entry to null. */
const normalizeReportDetails = (value: string): string | null => {
  const trimmed = value.trim();

  return trimmed.length === 0 ? null : trimmed;
};

/** What the reporter chose. */
const reportReasonSchema = picklist(REASON_VALUES);
const reportTargetSchema = picklist(TARGET_VALUES);

/**
 * The validated request.
 *
 * A user is named by **username, not id**: the public profile deliberately does
 * not carry the account id, so a report filed from `/u/$username` cannot supply
 * one without either leaking that id to every visitor or adding a lookup the
 * loader already does. The server resolves the username to an id itself.
 *
 * A project is named by id, because its document already carries one.
 *
 * Only the field matching `targetKind` may be set, and the check is here rather
 * than in the handler so the same rule applies to every caller. The database
 * CHECK constraint repeats it: this is the friendly error, that is the
 * guarantee.
 */
const reportInputSchema = object({
  details: optional(string()),
  projectId: optional(string()),
  reason: reportReasonSchema,
  reportedUsername: optional(string()),
  targetKind: reportTargetSchema,
});

/**
 * The validated request, with the free-text cap applied.
 *
 * Written out rather than derived from `reportInputSchema`, because the length
 * bound is part of what "a valid report" means and belongs beside the reason
 * list rather than at the one call site that happens to be a server function.
 */
const reportSubmissionSchema = object({
  details: optional(
    pipe(
      string(),
      maxLength(
        REPORT_DETAILS_MAX_LENGTH,
        `That description is longer than ${REPORT_DETAILS_MAX_LENGTH} characters.`
      )
    )
  ),
  projectId: optional(string()),
  reason: reportReasonSchema,
  reportedUsername: optional(string()),
  targetKind: reportTargetSchema,
});

interface ReportInput {
  details?: string;
  projectId?: string;
  reason: ReportReason;
  reportedUsername?: string;
  targetKind: ReportTarget;
}

/**
 * Checks that the request names exactly one target, and returns why not.
 *
 * A report with no target, or with both, is refused rather than guessed at: an
 * inbox entry about nothing cannot be actioned, and picking a target for the
 * reporter would put the wrong thing in front of a moderator.
 */
const validateReportTarget = (input: ReportInput): string | null => {
  const hasProject = Boolean(input.projectId);
  const hasUser = Boolean(input.reportedUsername);

  if (input.targetKind === "project") {
    if (!hasProject) {
      return "Choose which project to report.";
    }
    if (hasUser) {
      return "A project report cannot also name a user.";
    }
    return null;
  }

  if (!hasUser) {
    return "Choose which user to report.";
  }
  if (hasProject) {
    return "A user report cannot also name a project.";
  }
  return null;
};

/** A report as the admin inbox renders it. */
export interface ReportRow {
  createdAt: Date | string;
  details: string | null;
  id: string;
  /** Null once the reporter's account is deleted; see the schema note. */
  reporterEmail: string | null;
  reporterId: string | null;
  reporterName: string | null;
  /** Null once the reported project is deleted. */
  projectName: string | null;
  projectSlug: string | null;
  reason: ReportReason;
  reportedUserId: string | null;
  reportedUserName: string | null;
  reportedUserUsername: string | null;
  resolution: ReportResolution | null;
  /** When it left the queue; null while open. */
  resolvedAt: Date | string | null;
  status: ReportStatus;
  targetKind: ReportTarget;
}

export {
  normalizeReportDetails,
  reportReasonLabel,
  reportReasonSchema,
  reportTargetLabel,
  reportTargetSchema,
  reportInputSchema,
  reportSubmissionSchema,
  toReportReason,
  toReportResolution,
  toReportStatus,
  toReportTarget,
  validateReportTarget,
};
export type { ReportInput };
