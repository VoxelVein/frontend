import { parse } from "valibot";
import { describe, expect, it } from "vitest";

import {
  normalizeReportDetails,
  REPORT_DETAILS_MAX_LENGTH,
  REPORT_REASONS,
  reportInputSchema,
  reportReasonLabel,
  reportReasonSchema,
  reportSubmissionSchema,
  reportTargetLabel,
  reportTargetSchema,
  toReportReason,
  toReportResolution,
  toReportStatus,
  toReportTarget,
  validateReportTarget,
} from "@/lib/reports";
import type { ReportInput } from "@/lib/reports";

/**
 * Whether a payload passes a schema.
 *
 * The call is a thunk so the schema and the value are resolved together at the
 * call site, and the result is discarded because what is being asserted is
 * whether the schema accepted the payload at all.
 */
const parses = (run: () => void): boolean => {
  try {
    run();
    return true;
  } catch {
    return false;
  }
};

const input = (overrides: Partial<ReportInput> = {}): ReportInput => ({
  reason: "spam",
  targetKind: "project",
  ...overrides,
});

describe(validateReportTarget, () => {
  it("accepts a project report naming only a project", () => {
    expect(validateReportTarget(input({ projectId: "p1" }))).toBeNull();
  });

  it("accepts a user report naming only a username", () => {
    expect(
      validateReportTarget(
        input({ reportedUsername: "ada", targetKind: "user" })
      )
    ).toBeNull();
  });

  it("refuses a project report with no project", () => {
    expect(validateReportTarget(input())).toMatch(/which project/iu);
  });

  it("refuses a user report with no user", () => {
    expect(validateReportTarget(input({ targetKind: "user" }))).toMatch(
      /which user/iu
    );
  });

  it("refuses a report naming both a project and a user", () => {
    // A row about two things is a row a moderator cannot action, and guessing
    // which one was meant would put the wrong thing in front of them.
    expect(
      validateReportTarget(input({ projectId: "p1", reportedUsername: "ada" }))
    ).toMatch(/cannot also name a user/iu);

    expect(
      validateReportTarget(
        input({
          projectId: "p1",
          reportedUsername: "ada",
          targetKind: "user",
        })
      )
    ).toMatch(/cannot also name a project/iu);
  });

  it("treats an empty string as absent, not as a target", () => {
    // A client that sends `""` for "no target" must be refused, not accepted.
    expect(validateReportTarget(input({ projectId: "" }))).toMatch(
      /which project/iu
    );
  });
});
// Spelled out rather than referencing the schema: vitest accepts only a string
// or a function as a describe label, and the schema is neither.
describe("submitted report payload", () => {
  it("accepts a well-formed report", () => {
    expect(
      parses(() => {
        parse(reportInputSchema, {
          details: "nope",
          projectId: "p1",
          reason: "malware",
          targetKind: "project",
        });
      })
    ).toBeTruthy();
  });

  it("refuses a reason outside the closed list", () => {
    // The list is closed so the inbox can be triaged by reason; free text here
    // would be a bucket nobody can filter.
    expect(
      parses(() => {
        parse(reportInputSchema, {
          projectId: "p1",
          reason: "because-i-said-so",
          targetKind: "project",
        });
      })
    ).toBeFalsy();
  });

  it("refuses an unknown target kind", () => {
    expect(
      parses(() => {
        parse(reportInputSchema, { reason: "spam", targetKind: "server" });
      })
    ).toBeFalsy();
  });

  it("names a user by username rather than by id", () => {
    // The public profile deliberately omits the account id, so a report filed
    // from it has no id to send.
    expect(
      parses(() => {
        parse(reportInputSchema, {
          reason: "harassment",
          reportedUsername: "ada",
          targetKind: "user",
        });
      })
    ).toBeTruthy();
  });

  it("leaves the details uncapped here; the submission schema caps them", () => {
    const long = "x".repeat(REPORT_DETAILS_MAX_LENGTH + 1);

    expect(
      parses(() => {
        parse(reportInputSchema, {
          details: long,
          projectId: "p1",
          reason: "spam",
          targetKind: "project",
        });
      })
    ).toBeTruthy();
    expect(
      parses(() => {
        parse(reportSubmissionSchema, {
          details: long,
          projectId: "p1",
          reason: "spam",
          targetKind: "project",
        });
      })
    ).toBeFalsy();
  });

  it("accepts details right at the cap", () => {
    const exact = "x".repeat(REPORT_DETAILS_MAX_LENGTH);

    expect(
      parses(() => {
        parse(reportSubmissionSchema, {
          details: exact,
          projectId: "p1",
          reason: "spam",
          targetKind: "project",
        });
      })
    ).toBeTruthy();
  });
});

describe(normalizeReportDetails, () => {
  it("trims", () => {
    expect(normalizeReportDetails("  more context  ")).toBe("more context");
  });

  it("collapses whitespace-only prose to nothing", () => {
    // An empty string would store as an empty column rather than null, making
    // "said nothing" indistinguishable from "said something blank".
    expect(normalizeReportDetails("   \n  ")).toBeNull();
    expect(normalizeReportDetails("")).toBeNull();
  });
});

describe("stored value narrowing", () => {
  it("keeps a known reason and falls back to 'other'", () => {
    expect(toReportReason("malware")).toBe("malware");
    // An unrecognised reason stays visible and honest rather than rendering as
    // a blank chip nobody can read.
    expect(toReportReason("something-new")).toBe("other");
  });

  it("treats an unrecognised status as open, not as handled", () => {
    // The opposite failure would hide a report nobody had looked at.
    expect(toReportStatus("open")).toBe("open");
    expect(toReportStatus("resolved")).toBe("resolved");
    expect(toReportStatus("nonsense")).toBe("open");
  });

  it("reports a resolution only when one was recorded", () => {
    expect(toReportResolution("resolved")).toBe("resolved");
    expect(toReportResolution("dismissed")).toBe("dismissed");
    expect(toReportResolution("open")).toBeNull();
    expect(toReportResolution(null)).toBeNull();
  });

  it("reads an unknown target kind as a project", () => {
    // The conservative of the two mistakes: it points the moderator at a project
    // rather than at a person.
    expect(toReportTarget("project")).toBe("project");
    expect(toReportTarget("user")).toBe("user");
    expect(toReportTarget("nonsense")).toBe("project");
  });
});

describe("labels", () => {
  it("gives every reason a human label", () => {
    for (const reason of REPORT_REASONS) {
      expect(reportReasonLabel(reason.value)).toBe(reason.label);
    }
  });

  it("falls back to the raw value rather than rendering nothing", () => {
    expect(reportReasonLabel("invented")).toBe("invented");
    expect(reportTargetLabel("invented")).toBe("invented");
    expect(reportTargetLabel("project")).toBe("a project");
  });
});

describe("schemas match their lists", () => {
  it("accepts every reason the UI offers", () => {
    for (const reason of REPORT_REASONS) {
      expect(
        parses(() => parse(reportReasonSchema, reason.value))
      ).toBeTruthy();
    }
  });

  it("accepts every target the UI offers", () => {
    for (const target of ["project", "user"] as const) {
      expect(
        parses(() => {
          parse(reportTargetSchema, target);
        })
      ).toBeTruthy();
    }
  });

  it("parses a report through the submission schema end to end", () => {
    const parsed = parse(reportSubmissionSchema, {
      details: "  ships a miner  ",
      projectId: "p1",
      reason: "malware",
      targetKind: "project",
    });

    expect(parsed.targetKind).toBe("project");
    expect(parsed.reason).toBe("malware");
  });
});
