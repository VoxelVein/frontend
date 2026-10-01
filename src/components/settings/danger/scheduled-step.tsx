import { useEffect } from "react";

import {
  purgeDateFormatter,
  SCHEDULED_REDIRECT_DELAY_MS,
} from "@/components/settings/danger/deletion-flow";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

interface ScheduledStepProps {
  purgeAt: string;
}

/**
 * Terminal step: the deletion is scheduled and the account is already
 * deactivated.
 *
 * Redirects on its own after a pause, since the session is dead and leaving
 * the user on a dead page helps nobody. The copy states the date in the
 * reader's locale rather than a relative "in 14 days", which would drift
 * between the moment it is read and the moment it is acted on.
 */
export const ScheduledStep = ({ purgeAt }: ScheduledStepProps) => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.assign("/");
    }, SCHEDULED_REDIRECT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="grid gap-4">
      <p aria-live="polite" className="text-foreground text-sm">
        Your account is deactivated and will be permanently deleted on{" "}
        {purgeDateFormatter.format(new Date(purgeAt))}. Contact VoxelVein
        support before then if you change your mind. You’ll be taken to the home
        page shortly.
      </p>
      <DialogFooter>
        <Button
          type="button"
          variant="default"
          className="min-h-11"
          onClick={() => window.location.assign("/")}
        >
          Go to the home page
        </Button>
      </DialogFooter>
    </div>
  );
};
