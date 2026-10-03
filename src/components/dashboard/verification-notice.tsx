import { IconMailExclamation } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

interface VerificationNoticeProps {
  /** The signed-in user's address, so the notice can name where to look. */
  email: string;
}

/**
 * Shown to signed-in users who may not publish content yet.
 *
 * This used to be a heading and two sentences with no way to act on either: it
 * told you to verify your email and then left you to guess that the verification
 * mail had expired, never arrived, or been filtered. A blocked publish with no
 * button and no inbox guidance is the worst version of this message, so the
 * notice now names the address, says what to look for, and offers a resend.
 *
 * The resend button is the reason this is a component rather than markup: it
 * holds pending state and surfaces failures, which a static banner cannot.
 */
export const VerificationNotice = ({ email }: VerificationNoticeProps) => {
  const [isSending, setIsSending] = useState(false);

  const handleResend = async () => {
    setIsSending(true);

    const { error } = await authClient.sendVerificationEmail({
      callbackURL: "/dashboard/projects",
      email,
    });

    setIsSending(false);

    if (error) {
      toast.error(
        error.message ?? "Could not send another verification email. Try again."
      );
      return;
    }

    toast.success(`Sent another verification email to ${email}.`);
  };

  return (
    <section
      aria-labelledby="verification-heading"
      className="border-border bg-muted/50 mt-8 flex gap-4 rounded-xl border p-6"
    >
      <IconMailExclamation
        size={24}
        aria-hidden="true"
        className="text-primary shrink-0"
      />
      <div className="grid gap-3">
        <div>
          <h2
            id="verification-heading"
            className="text-foreground text-lg font-semibold"
          >
            Verify your email to publish
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Only accounts with a verified email address can upload projects.
            Accounts created with Google or GitHub are verified automatically.
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Open the email we sent to <strong>{email}</strong> and follow the
            link in it. The message can take a few minutes to arrive, so check
            your spam folder before sending another.
          </p>
        </div>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={isSending}
            onClick={handleResend}
          >
            {isSending ? (
              <>
                <Spinner className="mr-1" />
                Sending…
              </>
            ) : (
              "Resend verification email"
            )}
          </Button>
        </div>
      </div>
    </section>
  );
};
