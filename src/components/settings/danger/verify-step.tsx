import { IconCircleCheck } from "@tabler/icons-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { FormField } from "@/components/form-field";
import type { DeletionContext } from "@/components/settings/danger/deletion-flow";
import {
  REAUTH_CALLBACK_URL,
  writePendingDeletion,
} from "@/components/settings/danger/deletion-flow";
import {
  getConfiguredSocialProviders,
  useLinkedAccounts,
} from "@/components/settings/sign-in-providers";
import type { SocialProviderId } from "@/components/settings/sign-in-providers";
import { AlertDescription, AlertTitle, Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

interface VerifyStepProps {
  context: DeletionContext;
  initialPasswordError: string | null;
  isDifferentAccount: boolean;
  keepProjectIds: string[];
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onVerified: (password: string | null) => void;
  userId: string | null;
}

/**
 * Step 2: prove the account belongs to whoever is sitting at it.
 *
 * Three routes in, because each of them can be what the user actually has:
 * a password, a passkey, or a social provider. A social sign-in leaves the
 * page, so the choices made so far are persisted first and the wizard resumes
 * on return.
 */
export const VerifyStep = ({
  context,
  initialPasswordError,
  isDifferentAccount,
  keepProjectIds,
  onBack,
  onRefresh,
  onVerified,
  userId,
}: VerifyStepProps) => {
  const { data: accounts } = useLinkedAccounts();
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(initialPasswordError);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const isVerified = context.reauthenticatedUntil !== null;
  const linkedProviders = getConfiguredSocialProviders().filter((provider) =>
    accounts?.some((account) => account.providerId === provider.id)
  );

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) {
      setPasswordError("Enter your password to continue.");
      return;
    }
    onVerified(password);
  };

  const handlePasskey = async () => {
    setActionError(null);
    setIsBusy(true);
    const { error } = await authClient.signIn.passkey();
    if (error) {
      setIsBusy(false);
      setActionError(error.message ?? "Could not verify with a passkey.");
      return;
    }
    authClient.$store.notify("$sessionSignal");
    await onRefresh();
    setIsBusy(false);
  };

  const handleSocial = async (providerId: SocialProviderId) => {
    setActionError(null);
    setIsBusy(true);
    if (userId) {
      writePendingDeletion({ keepProjectIds, userId });
    }
    const { error } = await authClient.signIn.social({
      callbackURL: REAUTH_CALLBACK_URL,
      provider: providerId,
    });
    if (error) {
      setIsBusy(false);
      setActionError(error.message ?? "Could not start signing in.");
    }
  };

  if (isDifferentAccount) {
    return (
      <div className="grid gap-4">
        <Alert variant="destructive">
          <AlertTitle>You signed in as a different account</AlertTitle>
          <AlertDescription>
            You are now signed in to another VoxelVein account than the one you
            started deleting. Nothing was deleted. Close this dialog and start
            again if you want to delete the account you are signed in to now.
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={onBack}
          >
            Back
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (isVerified) {
    return (
      <div className="grid gap-4">
        <p className="text-foreground flex items-center gap-2 text-sm">
          <IconCircleCheck aria-hidden size={18} className="text-primary" />
          Verified. You signed in recently, so no extra check is needed.
        </p>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={onBack}
          >
            Back
          </Button>
          <Button
            type="button"
            variant="default"
            className="min-h-11"
            onClick={() => onVerified(null)}
          >
            Continue
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="grid gap-4" aria-busy={isBusy}>
      <p className="text-muted-foreground text-sm">
        For your security, confirm it’s you before deleting your account.
      </p>

      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {context.hasPassword ? (
        <form
          id="delete-verify-password-form"
          onSubmit={handlePasswordSubmit}
          noValidate
          className="grid gap-3"
        >
          <FormField
            id="delete-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError(null);
            }}
            error={passwordError ?? undefined}
            required
          />
          <Button
            type="submit"
            variant="default"
            className="min-h-11 sm:justify-self-start sm:px-6"
            disabled={isBusy}
          >
            Continue with password
          </Button>
        </form>
      ) : null}

      <div className="grid gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={isBusy}
          onClick={() => {
            void handlePasskey();
          }}
        >
          {isBusy ? <Spinner className="mr-1" /> : null}
          Use a passkey
        </Button>
        {linkedProviders.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={isBusy}
            onClick={() => {
              void handleSocial(provider.id);
            }}
          >
            <provider.icon aria-hidden size={16} />
            Continue with {provider.label}
          </Button>
        ))}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={isBusy}
          onClick={onBack}
        >
          Back
        </Button>
      </DialogFooter>
    </div>
  );
};
