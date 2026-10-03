import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { object, parse, picklist, pipe, string, uuid } from "valibot";

import { db } from "@/db";
import { projects, reports, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  consumeServerLimit,
  RATE_LIMIT_MESSAGE,
} from "@/lib/rate-limit-server";
import {
  normalizeReportDetails,
  REPORT_RESOLUTIONS,
  reportSubmissionSchema,
  toReportReason,
  toReportResolution,
  toReportStatus,
  toReportTarget,
  validateReportTarget,
} from "@/lib/reports";
import type {
  ReportInput,
  ReportResolution,
  ReportRow,
  ReportTarget,
} from "@/lib/reports";
import { requireCapability } from "@/lib/role-guards";
import type { StaffSession } from "@/lib/role-guards";

/**
 * Filing a report, and the queue a moderator works through.
 *
 * Every capability check lives here rather than in the UI: the report control is
 * a button on a public page, so anything enforced only there would be enforced
 * by nothing at all.
 */

/** Refused rather than returned as null, so no handler can forget to check. */
const requireModerator = (): Promise<StaffSession> =>
  requireCapability("manageReports");

/**
 * Any signed-in account may report.
 *
 * Deliberately weaker than `requireUploader`: reporting is a safety valve, and
 * gating it behind a verified email would mean the people most likely to need
 * it — a banned or unverified account — could not use it.
 */
const requireMember = async (): Promise<StaffSession> => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) {
    throw new Error("Sign in to report something.");
  }
  return session;
};

/**
 * Caps how much one account can put in the queue.
 *
 * Keyed on the user id, so a shared NAT does not throttle everyone behind it and
 * reconnecting cannot buy more reports. Fails open with the rest of the limiter:
 * reports nobody files are a far smaller problem than an outage.
 */
const requireReportQuota = async (session: StaffSession): Promise<void> => {
  const quota = await consumeServerLimit(
    "report-filing",
    `user:${session.user.id}`,
    RATE_LIMITS.report
  );
  if (quota) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }
};

/**
 * Whether this account already has an open report against this target.
 *
 * The rate limit bounds the volume; this bounds the duplicate. Without it,
 * someone who disagrees with a decision can refile the same report every few
 * minutes forever and the moderator sees twenty identical rows instead of one.
 *
 * Checked rather than enforced by a unique index, because the constraint only
 * applies while a report is open — a resolved report must not block reporting
 * the same thing again later.
 */
const alreadyReported = async (
  reporterId: string,
  targetKind: ReportTarget,
  targetId: string
): Promise<boolean> => {
  const targetColumn =
    targetKind === "project" ? reports.projectId : reports.reportedUserId;
  const [row] = await db
    .select({ total: count() })
    .from(reports)
    .where(
      and(
        eq(reports.reporterId, reporterId),
        eq(reports.targetKind, targetKind),
        eq(targetColumn, targetId),
        isNull(reports.resolvedAt)
      )
    );

  return (row?.total ?? 0) > 0;
};

/**
 * Resolves the named target to an id, or refuses the report.
 *
 * A user is looked up by username because that is all a profile URL carries —
 * `PublicProfile` deliberately omits the account id, so the client has nothing
 * else to send. A project is looked up by the id its document already carries.
 *
 * Both resolve to "no longer exists" rather than "not found", because from the
 * reporter's side those are the same situation and the second tells them the
 * site is echoing their input back rather than that anything is wrong.
 */
const resolveTargetId = async (input: ReportInput): Promise<string> => {
  if (input.targetKind === "project") {
    if (!input.projectId) {
      throw new Error("Choose which project to report.");
    }
    const [row] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, input.projectId))
      .limit(1);

    if (!row) {
      throw new Error("That project no longer exists.");
    }
    return row.id;
  }

  if (!input.reportedUsername) {
    throw new Error("Choose which user to report.");
  }
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, input.reportedUsername.toLowerCase()))
    .limit(1);

  if (!row) {
    throw new Error("That account no longer exists.");
  }
  return row.id;
};

/** Files a report. */
export const createReport = createServerFn({ method: "POST" })
  .validator((data: ReportInput) => parse(reportSubmissionSchema, data))
  .handler(async ({ data }): Promise<void> => {
    const session = await requireMember();

    const targetProblem = validateReportTarget(data);
    if (targetProblem) {
      throw new Error(targetProblem);
    }

    const targetId = await resolveTargetId(data);

    // Checked against the resolved id rather than the submitted username, so
    // neither a differently-cased handle nor a rename can slip past it.
    if (targetId === session.user.id) {
      throw new Error("You cannot report yourself.");
    }

    await requireReportQuota(session);

    if (await alreadyReported(session.user.id, data.targetKind, targetId)) {
      throw new Error("You have already reported this.");
    }

    await db.insert(reports).values({
      details: normalizeReportDetails(data.details ?? ""),
      projectId: data.targetKind === "project" ? targetId : null,
      reason: data.reason,
      reporterId: session.user.id,
      reportedUserId: data.targetKind === "user" ? targetId : null,
      targetKind: data.targetKind,
    });
  });

/** How many reports are awaiting a decision, for the tab badge. */
export const countOpenReports = createServerFn({ method: "GET" }).handler(
  async (): Promise<number> => {
    await requireModerator();
    const [row] = await db
      .select({ open: count() })
      .from(reports)
      .where(isNull(reports.resolvedAt));

    return row?.open ?? 0;
  }
);

/**
 * Every report, newest first, with the reporter and the target joined in.
 *
 * Left joins throughout, because a report outlives both of its people: the
 * reporter's account and the reported account can each be deleted while the row
 * stays, and the inbox must still show what it was about.
 */
export const listReports = createServerFn({ method: "GET" }).handler(
  async (): Promise<ReportRow[]> => {
    await requireModerator();

    // The reporter and the reported account are both `users`, so the second
    // needs its own alias or the join would collapse them into one.
    const reportedUser = alias(users, "reported_user");

    const rows = await db
      .select({
        createdAt: reports.createdAt,
        details: reports.details,
        id: reports.id,
        projectName: projects.name,
        projectSlug: projects.slug,
        reason: reports.reason,
        reporterEmail: users.email,
        reporterId: reports.reporterId,
        reporterName: users.name,
        reportedUserId: reports.reportedUserId,
        reportedUserName: reportedUser.name,
        reportedUserUsername: reportedUser.displayUsername,
        resolution: reports.status,
        resolvedAt: reports.resolvedAt,
        targetKind: reports.targetKind,
      })
      .from(reports)
      .leftJoin(users, eq(users.id, reports.reporterId))
      .leftJoin(reportedUser, eq(reportedUser.id, reports.reportedUserId))
      .leftJoin(projects, eq(projects.id, reports.projectId))
      .orderBy(desc(reports.createdAt));

    return rows.map((row) => ({
      ...row,
      reason: toReportReason(row.reason),
      resolution: toReportResolution(row.resolution),
      status: toReportStatus(row.resolution),
      targetKind: toReportTarget(row.targetKind),
    }));
  }
);

const resolutionSchema = object({
  id: pipe(string(), uuid()),
  resolution: picklist(REPORT_RESOLUTIONS),
});

interface ResolutionInput {
  id: string;
  resolution: ReportResolution;
}

/** Marks a report actioned or dismissed. */
export const resolveReport = createServerFn({ method: "POST" })
  .validator((data: ResolutionInput) => parse(resolutionSchema, data))
  .handler(async ({ data }): Promise<void> => {
    const session = await requireModerator();
    const resolution: ReportResolution = data.resolution;

    await db
      .update(reports)
      .set({
        resolvedAt: new Date(),
        resolvedById: session.user.id,
        status: resolution,
      })
      .where(eq(reports.id, data.id));
  });
