import { useState } from "react";
import type { FormEvent } from "react";

import { FormField } from "@/components/form-field";
import type { DeletionContext } from "@/components/settings/danger/deletion-flow";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

interface ConfirmStepProps {
  expected: string;
  mode: DeletionContext["mode"];
  onBack: () => void;
  onSubmit: (confirmation: string) => Promise<string | null>;
}

/**
 * Step 3: the last gate before anything is destroyed.
 *
 * Requires typing the account name rather than just clicking through, so the
 * action cannot happen by reflex. The destructive button stays disabled until
 * the text matches, which means the user has read what they are confirming.
 */
export const ConfirmStep = ({
  expected,
  mode,
  onBack,
  onSubmit,
}: ConfirmStepProps) => {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const matches =
    confirmation.trim().toLowerCase() === expected.trim().toLowerCase();
  const actionLabel =
    mode === "immediate" ? "Delete account" : "Schedule deletion";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!matches) {
      setError(`Type ${expected} to confirm.`);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const submitError = await onSubmit(confirmation.trim());
    setIsSubmitting(false);
    setError(submitError);
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-busy={isSubmitting}
      className="grid gap-4"
    >
      <p className="text-foreground text-sm">
        To confirm, type{" "}
        <code className="bg-muted rounded px-1 py-0.5 font-mono">
          {expected}
        </code>{" "}
        below.
      </p>
      <FormField
        id="delete-confirmation"
        label={`Type ${expected} to confirm`}
        type="text"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={confirmation}
        onChange={(event) => {
          setConfirmation(event.target.value);
          setError(null);
        }}
        error={error ?? undefined}
        required
      />
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={isSubmitting}
          onClick={onBack}
        >
          Back
        </Button>
        <Button
          type="submit"
          variant="destructive"
          className="min-h-11"
          disabled={isSubmitting || !matches}
        >
          {isSubmitting ? <Spinner className="mr-1" /> : null}
          {actionLabel}
        </Button>
      </DialogFooter>
    </form>
  );
};
