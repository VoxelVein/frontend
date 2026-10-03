import { IconFlag } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { FormTextarea } from "@/components/form-textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/form-errors";
import { REPORT_DETAILS_MAX_LENGTH, REPORT_REASONS } from "@/lib/reports";
import type { ReportReason, ReportTarget } from "@/lib/reports";
import { createReport } from "@/lib/reports.functions";

interface ReportDialogProps {
  targetKind: ReportTarget;
  /** What the dialog calls the target, e.g. a project name. */
  targetLabel: string;
  /** The project's id. Ignored for a user target. */
  projectId?: string;
  /** The account's normalised username. Ignored for a project target. */
  reportedUsername?: string;
  /**
   * Why this control is absent, when it is.
   *
   * Rendered as an explanation rather than nothing at all: a member looking for
   * a way to report something and finding no control is worse than being told
   * they cannot.
   */
  unavailableReason?: string;
}

/**
 * Files a report about a project or an account.
 *
 * The submit button stays disabled until a reason is chosen, because "report"
 * with no reason produces an inbox row a moderator cannot triage, and the
 * server would accept it.
 *
 * Details are optional on purpose. Requiring prose makes people who know
 * immediately that something is wrong instead type filler, and a filler reason
 * is worth less than a bare, accurate category.
 */
const ReportDialog = ({
  projectId,
  reportedUsername,
  targetKind,
  targetLabel,
  unavailableReason,
}: ReportDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setReason("");
    setDetails("");
    setError(null);
  };

  const handleSubmit = async () => {
    if (!reason) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await createReport({
        data: {
          details,
          reason,
          targetKind,
          ...(targetKind === "project" ? { projectId } : { reportedUsername }),
        },
      });
      toast.success("Thanks. A moderator will look at it.");
      setIsOpen(false);
      reset();
    } catch (submitError) {
      // Kept inline rather than only toasted: the dialog stays open, so the
      // message belongs next to the form rather than in a corner that may be
      // behind the overlay on a small screen.
      setError(errorMessage(submitError, "Could not send the report."));
    }
    setIsBusy(false);
  };

  const hasTarget =
    targetKind === "project" ? Boolean(projectId) : Boolean(reportedUsername);

  if (unavailableReason !== undefined || !hasTarget) {
    return (
      <p className="text-muted-foreground text-sm">
        {unavailableReason ?? "This cannot be reported."}
      </p>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          reset();
        }
      }}
    >
      <DialogTrigger
        render={<Button type="button" variant="ghost" className="min-h-11" />}
      >
        <IconFlag size={16} aria-hidden="true" />
        Report
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report {targetLabel}</DialogTitle>
          <DialogDescription>
            Tell a moderator what is wrong. They will look at it, and nothing
            happens to {targetLabel} automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <fieldset>
            <legend className="text-foreground mb-2 text-sm font-medium">
              What is wrong?
            </legend>
            <div className="grid gap-1">
              {REPORT_REASONS.map((option) => (
                <label
                  key={option.value}
                  className="hover:bg-muted/60 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={option.value}
                    checked={reason === option.value}
                    onChange={() => {
                      setReason(option.value);
                      setError(null);
                    }}
                    className="accent-primary size-4"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <FormTextarea
            id="report-details"
            label="Anything else? (optional)"
            rows={4}
            value={details}
            maxLength={REPORT_DETAILS_MAX_LENGTH}
            onChange={(event) => {
              setDetails(event.target.value);
            }}
            helperText={`Up to ${REPORT_DETAILS_MAX_LENGTH} characters.`}
            error={error ?? undefined}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            onClick={() => {
              setIsOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={isBusy || reason === ""}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {isBusy ? (
              <>
                <Spinner className="mr-1" />
                Sending…
              </>
            ) : (
              "Send report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { ReportDialog };
