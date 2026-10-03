import { IconInbox } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import {
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  Card,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/form-errors";
import { formatDate } from "@/lib/format";
import { relativeTime } from "@/lib/relative-time";
import type { ReportResolution, ReportRow } from "@/lib/reports";
import { reportReasonLabel } from "@/lib/reports";
import { listReports, resolveReport } from "@/lib/reports.functions";

/** What the card header says about the queue. */
const describeQueue = (openCount: number): string => {
  if (openCount === 0) {
    return "Nothing is waiting on you. Reports members have filed are listed below.";
  }

  const noun = openCount === 1 ? "report is" : "reports are";

  return `${openCount} ${noun} waiting, newest first.`;
};

/**
 * What the confirmation says.
 *
 * Both outcomes close the report and neither tells the reporter, so the dialog
 * has to be explicit about which one is happening — a generic "are you sure?"
 * would leave a moderator guessing whether they are about to action or dismiss.
 */
const describeResolution = (resolution: ReportResolution): string =>
  resolution === "dismissed"
    ? "This closes the report without any action being taken. The reporter is told it was dismissed."
    : "This closes the report and records that it was actioned. The reporter is told the outcome.";

interface ListState {
  error: string | null;
  isLoading: boolean;
  /**
   * One instant, stamped whenever the list changes, so every relative time in
   * the panel is measured against the same moment rather than against whenever
   * each row happened to render.
   */
  loadedAt: number;
  rows: ReportRow[];
}

const LOADING_STATE: ListState = {
  error: null,
  isLoading: true,
  loadedAt: Date.now(),
  rows: [],
};

const fetchReports = async (): Promise<ListState> => {
  const loadedAt = Date.now();
  try {
    return {
      error: null,
      isLoading: false,
      loadedAt,
      rows: await listReports(),
    };
  } catch (error) {
    return {
      error: errorMessage(error, "Could not load reports."),
      isLoading: false,
      loadedAt,
      rows: [],
    };
  }
};

/**
 * Who filed it.
 *
 * An unattributed report is still worth triaging, so a deleted reporter reads
 * as a fact about the report rather than as a broken row.
 */
const ReportByline = ({ report }: { report: ReportRow }) => (
  <span className="text-sm">
    {report.reporterId === null ? (
      <span className="text-muted-foreground">Deleted user</span>
    ) : (
      <>
        <span className="text-foreground font-medium">
          {report.reporterName ?? "Unknown"}
        </span>
        {report.reporterEmail ? (
          <span className="text-muted-foreground">
            {" "}
            · {report.reporterEmail}
          </span>
        ) : null}
      </>
    )}
  </span>
);

/**
 * What was reported.
 *
 * A link when the target still exists, plain text when it does not: a report
 * about a deleted project stays in the queue as history, and offering a link
 * that 404s would be worse than saying plainly that it is gone.
 */
const Target = ({ report }: { report: ReportRow }) => {
  if (report.targetKind === "project") {
    if (!report.projectSlug) {
      return <span className="text-sm">Deleted project</span>;
    }
    return (
      <span className="text-sm">
        <span className="text-foreground font-medium">
          {report.projectName}
        </span>{" "}
        <span className="text-muted-foreground">/{report.projectSlug}</span>
      </span>
    );
  }

  if (!report.reportedUserId) {
    return <span className="text-sm">Deleted account</span>;
  }

  return (
    <span className="text-sm">
      <span className="text-foreground font-medium">
        {report.reportedUserName ?? "Unknown"}
      </span>
      {report.reportedUserUsername ? (
        <span className="text-muted-foreground">
          {" "}
          @{report.reportedUserUsername}
        </span>
      ) : null}
    </span>
  );
};

const ReportRowView = ({
  isMutating,
  loadedAt,
  report,
  onResolve,
}: {
  isMutating: boolean;
  loadedAt: number;
  report: ReportRow;
  onResolve: (report: ReportRow, resolution: ReportResolution) => void;
}) => {
  const isOpen = report.status === "open";

  return (
    <li className="border-border flex flex-wrap items-start justify-between gap-4 border-b py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border-border bg-muted text-muted-foreground inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium">
            {reportReasonLabel(report.reason)}
          </span>
          <span className="text-muted-foreground text-xs">
            {report.targetKind === "project" ? "Project" : "User"} reported
          </span>
        </div>

        <div className="mt-1.5">
          <Target report={report} />
        </div>

        {report.details ? (
          <p className="text-muted-foreground mt-1.5 text-sm leading-6">
            {report.details}
          </p>
        ) : null}

        {/* Reported by, and when: a report with no visible reporter context is
            much harder to judge, because the credibility of the claim matters. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="text-muted-foreground">Reported by</span>
          <ReportByline report={report} />
          <span className="text-muted-foreground">
            · {relativeTime(report.createdAt, loadedAt)}
          </span>
          <span className="text-muted-foreground">
            · {formatDate(new Date(report.createdAt).toISOString())}
          </span>
        </div>
      </div>

      {isOpen ? (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={isMutating}
            onClick={() => {
              onResolve(report, "resolved");
            }}
          >
            Mark actioned
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={isMutating}
            onClick={() => {
              onResolve(report, "dismissed");
            }}
          >
            Dismiss
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground shrink-0 text-xs">
          {report.status === "resolved" ? "Actioned" : "Dismissed"}
        </p>
      )}
    </li>
  );
};

interface AdminReportsProps {
  /** Called after a resolution so the tab badge can drop the row. */
  onResolved: () => Promise<void>;
}

const AdminReports = ({ onResolved }: AdminReportsProps) => {
  const [list, setList] = useState<ListState>(LOADING_STATE);
  const { error: loadError, isLoading, loadedAt, rows: reports } = list;
  const [isMutating, setIsMutating] = useState(false);
  const [pending, setPending] = useState<{
    report: ReportRow;
    resolution: ReportResolution;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const loadOnMount = async () => {
      const next = await fetchReports();
      if (isCurrent) {
        setList(next);
      }
    };
    void loadOnMount();
    return () => {
      isCurrent = false;
    };
  }, []);

  const load = async () => {
    setList((current) => ({ ...current, error: null, isLoading: true }));
    setList(await fetchReports());
  };

  const handleResolve = async () => {
    if (!pending) {
      return;
    }
    const { report, resolution } = pending;
    setIsMutating(true);
    setActionError(null);
    try {
      await resolveReport({ data: { id: report.id, resolution } });
      setList((current) => ({
        ...current,
        rows: current.rows.map((row) =>
          row.id === report.id
            ? {
                ...row,
                resolvedAt: new Date().toISOString(),
                resolution,
                status: resolution,
              }
            : row
        ),
      }));
      setPending(null);
      toast.success(
        resolution === "resolved" ? "Report actioned." : "Report dismissed."
      );
      // The row is still in the local list, now closed, so the parent's open
      // count is stale by one and has to be re-read.
      await onResolved();
    } catch (error) {
      setActionError(errorMessage(error, "Could not update the report."));
    }
    setIsMutating(false);
  };

  const openCount = reports.filter((report) => report.status === "open").length;

  let content: ReactNode;

  if (isLoading) {
    content = (
      <div aria-busy="true" className="mt-4 grid gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  } else if (loadError) {
    content = <ErrorState message={loadError} onRetry={() => load()} />;
  } else if (reports.length === 0) {
    content = (
      <EmptyState
        variant="inline"
        title="No reports"
        description="When a member reports a project or another account, it appears here for you to look at."
        icon={<IconInbox size={20} aria-hidden="true" />}
      />
    );
  } else {
    content = (
      <ul className="mt-4">
        {reports.map((report) => (
          <ReportRowView
            key={report.id}
            isMutating={isMutating}
            loadedAt={loadedAt}
            report={report}
            onResolve={(target, resolution) => {
              setActionError(null);
              setPending({ report: target, resolution });
            }}
          />
        ))}
      </ul>
    );
  }

  const summary = describeQueue(openCount);

  return (
    <section aria-labelledby="admin-reports-heading">
      <Card>
        <CardHeader>
          <h2
            id="admin-reports-heading"
            className="text-foreground text-lg font-semibold"
          >
            Reports
          </h2>
          <CardDescription>{summary}</CardDescription>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                void load();
              }}
            >
              Refresh
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          {content}

          <ConfirmDialog
            open={pending !== null}
            onOpenChange={(open) => {
              if (!open) {
                setPending(null);
              }
            }}
            title={
              pending?.resolution === "dismissed"
                ? "Dismiss report"
                : "Mark report actioned"
            }
            description={pending ? describeResolution(pending.resolution) : ""}
            confirmLabel={
              // Distinct from the row button it confirms: two controls sharing an
              // accessible name in one view is ambiguous to announce and to click,
              // whichever of them the dialog happens to hide from the tree.
              pending?.resolution === "dismissed"
                ? "Yes, dismiss it"
                : "Yes, mark actioned"
            }
            pending={isMutating}
            // Shown in the dialog rather than in the panel behind it: the
            // failure happens while the dialog is open, and a message the modal
            // has just hidden from view is not a message.
            error={actionError}
            onConfirm={() => {
              void handleResolve();
            }}
          />
        </CardContent>
      </Card>
    </section>
  );
};

export { AdminReports };
// Referenced so the icon import is used by the empty state above.
