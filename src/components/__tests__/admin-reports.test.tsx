import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminReports } from "@/components/admin/admin-reports";
import type { ReportRow } from "@/lib/reports";

const { listReportsMock, resolveReportMock, toastMock } = vi.hoisted(() => ({
  listReportsMock: vi.fn<() => Promise<ReportRow[]>>(),
  resolveReportMock:
    vi.fn<
      (opts: { data: { id: string; resolution: string } }) => Promise<void>
    >(),
  toastMock: {
    error: vi.fn<(message: string) => void>(),
    success: vi.fn<(message: string) => void>(),
  },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The panel reads server functions; a string path avoids strict factory type-checking against the server function types
vi.mock("@/lib/reports.functions", () => ({
  listReports: listReportsMock,
  resolveReport: resolveReportMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Action feedback is a toast; stubbing Sonner is what makes the call assertable
vi.mock("sonner", () => ({ toast: toastMock }));

const openReport: ReportRow = {
  createdAt: "2026-02-01T09:00:00.000Z",
  details: "Ships a miner.",
  id: "report-1",
  projectName: "Sodium",
  projectSlug: "sodium",
  reason: "malware",
  reporterEmail: "ada@example.com",
  reporterId: "user-ada",
  reporterName: "Ada Lovelace",
  reportedUserId: null,
  reportedUserName: null,
  reportedUserUsername: null,
  resolution: null,
  resolvedAt: null,
  status: "open",
  targetKind: "project",
};

const userReport: ReportRow = {
  ...openReport,
  id: "report-2",
  projectName: null,
  projectSlug: null,
  reason: "harassment",
  reportedUserId: "user-ben",
  reportedUserName: "Ben Sabic",
  reportedUserUsername: "ben",
  targetKind: "user",
};

/** A report whose reporter and target have both been deleted. */
const orphanedReport: ReportRow = {
  ...openReport,
  id: "report-3",
  details: null,
  projectName: null,
  projectSlug: null,
  reporterEmail: null,
  reporterId: null,
  reporterName: null,
  reportedUserId: "user-gone",
  reportedUserName: null,
  reportedUserUsername: null,
  targetKind: "user",
};

const onResolved = vi.fn<() => Promise<void>>();

describe(AdminReports, () => {
  beforeEach(() => {
    listReportsMock.mockReset().mockResolvedValue([openReport]);
    resolveReportMock.mockReset().mockResolvedValue();
    onResolved.mockReset().mockResolvedValue();
    toastMock.error.mockReset();
    toastMock.success.mockReset();
  });

  it("shows the reported project and who reported it", async () => {
    render(<AdminReports onResolved={onResolved} />);

    await expect(screen.findByText("Sodium")).resolves.toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    // The email is what identifies a reporter to a moderator; the display name
    // alone can be anything.
    expect(screen.getByText(/ada@example\.com/iu)).toBeInTheDocument();
  });

  it("shows the reason as a readable label, not the stored slug", async () => {
    render(<AdminReports onResolved={onResolved} />);

    await expect(
      screen.findByText("Malware or malicious download")
    ).resolves.toBeInTheDocument();
    expect(screen.queryByText("malware")).not.toBeInTheDocument();
  });

  it("shows the reported user with their handle", async () => {
    listReportsMock.mockResolvedValue([userReport]);

    render(<AdminReports onResolved={onResolved} />);

    await expect(screen.findByText("Ben Sabic")).resolves.toBeInTheDocument();
    expect(screen.getByText(/@ben/iu)).toBeInTheDocument();
  });

  it("still lists a report whose people have been deleted", async () => {
    // A report is evidence about a target and outlives both accounts; an inbox
    // that dropped the row would lose the only record that it was ever filed.
    listReportsMock.mockResolvedValue([orphanedReport]);

    render(<AdminReports onResolved={onResolved} />);

    await expect(
      screen.findByText("Deleted user")
    ).resolves.toBeInTheDocument();
    expect(screen.getByText(/User reported/iu)).toBeInTheDocument();
  });

  it("shows the reporter's own words", async () => {
    render(<AdminReports onResolved={onResolved} />);

    await expect(
      screen.findByText("Ships a miner.")
    ).resolves.toBeInTheDocument();
  });

  it("offers no action on a report that is already closed", async () => {
    listReportsMock.mockResolvedValue([
      {
        ...openReport,
        resolution: "resolved",
        resolvedAt: "2026-02-02T00:00:00.000Z",
        status: "resolved",
      },
    ]);

    render(<AdminReports onResolved={onResolved} />);

    await expect(screen.findByText("Actioned")).resolves.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /mark actioned/iu })
    ).not.toBeInTheDocument();
  });

  it("keeps dismissed and actioned distinguishable", async () => {
    listReportsMock.mockResolvedValue([
      {
        ...openReport,
        id: "r1",
        resolution: "dismissed",
        resolvedAt: "2026-02-02T00:00:00.000Z",
        status: "dismissed",
      },
      {
        ...openReport,
        id: "r2",
        resolution: "resolved",
        resolvedAt: "2026-02-02T00:00:00.000Z",
        status: "resolved",
      },
    ]);

    render(<AdminReports onResolved={onResolved} />);

    // Collapsing these would lose the difference between "we did something" and
    // "we decided this was fine".
    await expect(screen.findByText("Dismissed")).resolves.toBeInTheDocument();
    expect(screen.getByText("Actioned")).toBeInTheDocument();
  });

  it("resolves a report only after the confirmation is accepted", async () => {
    render(<AdminReports onResolved={onResolved} />);
    fireEvent.click(
      await screen.findByRole("button", { name: /mark actioned/iu })
    );

    // Destructive enough to confirm: one click must not close a report.
    expect(resolveReportMock).not.toHaveBeenCalled();

    fireEvent.click(
      await screen.findByRole("button", { name: "Yes, mark actioned" })
    );

    await waitFor(() => {
      expect(resolveReportMock).toHaveBeenCalledWith({
        data: { id: "report-1", resolution: "resolved" },
      });
    });
  });

  it("dismisses a report as its own outcome, not as an absence of action", async () => {
    render(<AdminReports onResolved={onResolved} />);
    fireEvent.click(await screen.findByRole("button", { name: /dismiss/iu }));

    await expect(
      screen.findByText(/without any action being taken/iu)
    ).resolves.toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: "Yes, dismiss it" })
    );

    await waitFor(() => {
      expect(resolveReportMock).toHaveBeenCalledWith({
        data: { id: "report-1", resolution: "dismissed" },
      });
    });
  });

  it("refreshes the tab count after a decision", async () => {
    render(<AdminReports onResolved={onResolved} />);
    fireEvent.click(
      await screen.findByRole("button", { name: /mark actioned/iu })
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Yes, mark actioned" })
    );

    // The row stays in the list but closes, so the parent's open count is stale
    // by one and has to be re-read.
    await waitFor(() => {
      expect(onResolved).toHaveBeenCalledWith();
    });
  });

  it("keeps the report open when the decision fails", async () => {
    resolveReportMock.mockRejectedValue(new Error("Could not update."));

    render(<AdminReports onResolved={onResolved} />);
    fireEvent.click(
      await screen.findByRole("button", { name: /mark actioned/iu })
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Yes, mark actioned" })
    );

    await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
      "Could not update."
    );
    expect(onResolved).not.toHaveBeenCalled();
  });

  it("reports a load failure instead of showing an empty queue", async () => {
    listReportsMock.mockRejectedValue(new Error("Unauthorized."));

    render(<AdminReports onResolved={onResolved} />);

    // An empty inbox and a failed request look identical otherwise, and "no
    // reports" would read as an absence of problems.
    await expect(
      screen.findByText("Unauthorized.")
    ).resolves.toBeInTheDocument();
    expect(screen.queryByText("No reports")).not.toBeInTheDocument();
  });

  it("explains an empty queue rather than showing a blank panel", async () => {
    listReportsMock.mockResolvedValue([]);

    render(<AdminReports onResolved={onResolved} />);

    await expect(screen.findByText("No reports")).resolves.toBeInTheDocument();
  });

  it("counts only the reports still waiting", async () => {
    listReportsMock.mockResolvedValue([
      openReport,
      {
        ...openReport,
        id: "r2",
        resolution: "dismissed",
        resolvedAt: "2026-02-02T00:00:00.000Z",
        status: "dismissed",
      },
    ]);

    render(<AdminReports onResolved={onResolved} />);

    await expect(
      screen.findByText("1 report is waiting, newest first.")
    ).resolves.toBeInTheDocument();
  });
});
