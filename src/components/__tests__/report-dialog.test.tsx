import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReportDialog } from "@/components/reports/report-dialog";
import { REPORT_REASONS } from "@/lib/reports";

interface ReportSubmission {
  data: {
    details: string;
    projectId?: string;
    reason: string;
    reportedUsername?: string;
    targetKind: string;
  };
}

const { createReportMock, toastMock } = vi.hoisted(() => ({
  createReportMock: vi.fn<(opts: ReportSubmission) => Promise<void>>(),
  toastMock: {
    error: vi.fn<(message: string) => void>(),
    success: vi.fn<(message: string) => void>(),
  },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The dialog posts to a server function; a string path avoids strict factory type-checking against the server function types
vi.mock("@/lib/reports.functions", () => ({
  createReport: createReportMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Action feedback is a toast; stubbing Sonner is what makes the call assertable
vi.mock("sonner", () => ({ toast: toastMock }));

const openDialog = () => {
  fireEvent.click(screen.getByRole("button", { name: /report/iu }));
};

const chooseReason = (label: string | RegExp) => {
  fireEvent.click(screen.getByRole("radio", { name: label }));
};

const sendButton = () => screen.getByRole("button", { name: "Send report" });

describe(ReportDialog, () => {
  beforeEach(() => {
    createReportMock.mockReset().mockResolvedValue();
    toastMock.error.mockReset();
    toastMock.success.mockReset();
  });

  it("files a project report with the chosen reason", async () => {
    render(
      <ReportDialog
        projectId="p1"
        targetKind="project"
        targetLabel="this mod"
      />
    );
    openDialog();
    chooseReason(/spam/iu);
    fireEvent.click(sendButton());

    await waitFor(() => {
      expect(createReportMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: "p1",
          reason: "spam",
          targetKind: "project",
        }),
      });
    });
  });

  it("files a user report by username, not by id", async () => {
    // The public profile carries no account id, so the username is all a report
    // filed from `/u/$username` can name.
    render(
      <ReportDialog
        reportedUsername="ada"
        targetKind="user"
        targetLabel="@ada"
      />
    );
    openDialog();
    chooseReason(/harassment/iu);
    fireEvent.click(sendButton());

    await waitFor(() => {
      expect(createReportMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reason: "harassment",
          reportedUsername: "ada",
          targetKind: "user",
        }),
      });
    });
  });

  it("offers every reason in the list", () => {
    render(
      <ReportDialog
        projectId="p1"
        targetKind="project"
        targetLabel="this mod"
      />
    );
    openDialog();

    for (const reason of REPORT_REASONS) {
      expect(
        screen.getByRole("radio", { name: reason.label })
      ).toBeInTheDocument();
    }
  });

  it("cannot be sent until a reason is chosen", () => {
    render(
      <ReportDialog
        projectId="p1"
        targetKind="project"
        targetLabel="this mod"
      />
    );
    openDialog();

    // "Report" with no reason produces an inbox row nobody can triage.
    expect(sendButton()).toBeDisabled();
  });

  it("does not say a report acts on the target", () => {
    render(
      <ReportDialog
        projectId="p1"
        targetKind="project"
        targetLabel="this mod"
      />
    );
    openDialog();

    // The dialog exists precisely because a report is not a verdict.
    expect(
      screen.getByText(/nothing happens to this mod automatically/iu)
    ).toBeInTheDocument();
  });

  it("treats the details as optional", () => {
    render(
      <ReportDialog
        projectId="p1"
        targetKind="project"
        targetLabel="this mod"
      />
    );
    openDialog();
    chooseReason(/spam/iu);

    expect(sendButton()).toBeEnabled();
    expect(
      screen.getByLabelText(/anything else\? \(optional\)/iu)
    ).toBeInTheDocument();
  });

  it("sends the details the reporter typed", async () => {
    render(
      <ReportDialog
        projectId="p1"
        targetKind="project"
        targetLabel="this mod"
      />
    );
    openDialog();
    chooseReason(/spam/iu);
    fireEvent.change(screen.getByLabelText(/anything else/iu), {
      target: { value: "  it redirected me  " },
    });
    fireEvent.click(sendButton());

    await waitFor(() => {
      expect(createReportMock).toHaveBeenCalledWith({
        data: expect.objectContaining({ details: "  it redirected me  " }),
      });
    });
  });

  it("keeps the dialog open and reports the failure inline", async () => {
    createReportMock.mockRejectedValue(
      new Error("You have already reported this.")
    );

    render(
      <ReportDialog
        projectId="p1"
        targetKind="project"
        targetLabel="this mod"
      />
    );
    openDialog();
    chooseReason(/spam/iu);
    fireEvent.click(sendButton());

    // A toast can sit behind the overlay on a small screen, so the reason the
    // report was refused belongs next to the form.
    await expect(
      screen.findByText("You have already reported this.")
    ).resolves.toBeInTheDocument();
    expect(sendButton()).toBeInTheDocument();
  });

  it("confirms to the reporter that a moderator will look", async () => {
    render(
      <ReportDialog
        projectId="p1"
        targetKind="project"
        targetLabel="this mod"
      />
    );
    openDialog();
    chooseReason(/spam/iu);
    fireEvent.click(sendButton());

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith(
        "Thanks. A moderator will look at it."
      );
    });
  });

  it("explains why it cannot report rather than showing nothing", () => {
    render(
      <ReportDialog
        targetKind="project"
        targetLabel="this mod"
        unavailableReason="This is your project."
      />
    );

    // A member looking for a way to report something and finding no control is
    // worse than being told they cannot.
    expect(screen.getByText("This is your project.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /report/iu })
    ).not.toBeInTheDocument();
  });

  it("offers nothing when the target has no id at all", () => {
    render(<ReportDialog targetKind="project" targetLabel="this mod" />);

    expect(screen.getByText("This cannot be reported.")).toBeInTheDocument();
  });

  it("uses a radio group so one reason is chosen, not several", () => {
    render(
      <ReportDialog
        projectId="p1"
        targetKind="project"
        targetLabel="this mod"
      />
    );
    openDialog();

    expect(screen.getByRole("radio", { name: /spam/iu })).toHaveAttribute(
      "type",
      "radio"
    );
    expect(
      screen.getByRole("group", { name: /what is wrong\?/iu })
    ).toBeInTheDocument();
  });
});
