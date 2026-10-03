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
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/form-errors";
import type { PendingReview } from "@/lib/project-moderation";
import { rejectProject } from "@/lib/project-moderation.functions";

/** Matches the cap in the server-side rejection schema. */
const MAX_REASON_LENGTH = 2000;

const EMPTY_REASON = "";

/**
 * Asks an admin why a project is being sent back.
 *
 * The reason is mandatory and is shown verbatim to the creator, so the dialog
 * will not confirm with an empty box. Rejecting without a reason would put the
 * project back in draft with no explanation of what to fix, which is the state
 * the review step exists to prevent.
 */
export const RejectReviewDialog = ({
  onRejected,
  onOpenChange,
  review,
}: {
  onRejected: (projectId: string) => void;
  onOpenChange: (open: boolean) => void;
  review: PendingReview | null;
}) => {
  const [reason, setReason] = useState(EMPTY_REASON);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOpen = review !== null;
  const trimmed = reason.trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting;

  const close = () => {
    setReason(EMPTY_REASON);
    setError(null);
    onOpenChange(false);
  };

  const submit = async () => {
    if (!review || !canSubmit) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await rejectProject({
        data: { projectId: review.id, reason: trimmed },
      });
      onRejected(review.id);
      toast.success(`${review.name} was sent back to draft.`);
      close();
    } catch (submitError) {
      setError(
        errorMessage(
          submitError,
          "Could not send this project back to draft. Try again."
        )
      );
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          close();
        }
      }}
      open={isOpen}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send back to draft</DialogTitle>
          <DialogDescription>
            {review
              ? `${review.name} returns to draft and stays hidden from the site. The creator can fix it and submit again.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <FormTextarea
          id="rejection-reason"
          label="Reason"
          helperText="The creator sees this exactly as written, so say what needs to change."
          error={error ?? undefined}
          maxLength={MAX_REASON_LENGTH}
          placeholder="The description still points at the old API version."
          rows={5}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={isSubmitting}
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            disabled={!canSubmit}
            onClick={() => {
              void submit();
            }}
          >
            Send back to draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
