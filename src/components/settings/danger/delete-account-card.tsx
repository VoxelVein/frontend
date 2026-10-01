import { IconTrash } from "@tabler/icons-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { useEffect, useReducer, useRef } from "react";
import type { ReactNode } from "react";

import { ConfirmStep } from "@/components/settings/danger/confirm-step";
import { ConsequencesStep } from "@/components/settings/danger/consequences-step";
import type { DeleteAccountInput } from "@/components/settings/danger/deletion-flow";
import {
  clearPendingDeletion,
  deletionReducer,
  initDeletionState,
  VERIFICATION_ERROR_PATTERN,
} from "@/components/settings/danger/deletion-flow";
import { ScheduledStep } from "@/components/settings/danger/scheduled-step";
import { StepHeading } from "@/components/settings/danger/step-heading";
import { VerifyStep } from "@/components/settings/danger/verify-step";
import { AlertDescription, Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteAccount } from "@/lib/account.functions";
import type { AccountDeletionContext } from "@/lib/account.functions";
import { authClient } from "@/lib/auth-client";

/**
 * Re-reads the deletion context. Typed as the query result rather than
 * `unknown`, so a caller cannot silently pass a different shape.
 */
type RefetchContext = () => Promise<UseQueryResult<AccountDeletionContext>>;

interface DeleteAccountCardProps {
  contextError: Error | null;
  context: AccountDeletionContext | undefined;
  /** Called once a `confirm=delete` return from re-authentication is consumed. */
  onResumeHandled?: () => void;
  refetch: RefetchContext;
  /** The page came back from a re-authentication redirect mid-deletion. */
  resumeDeletion?: boolean;
}

const ContextError = ({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) => (
  <Alert variant="destructive">
    <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
      <span>{error.message || "Could not load your account."}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        onClick={onRetry}
      >
        Try again
      </Button>
    </AlertDescription>
  </Alert>
);

const ContextSkeleton = () => (
  <div aria-busy="true" className="grid gap-3">
    <Skeleton className="h-6" />
    <Skeleton className="h-16" />
  </div>
);

/**
 * The one destructive action in settings.
 *
 * Sign-out used to sit beside this button and was styled destructively too,
 * which made a reversible action look as serious as this one and left the
 * genuinely dangerous button with nothing to stand out against. Sign-out is
 * in the navbar user menu, so nothing was lost by dropping it here.
 *
 * The wizard itself is unchanged: consequences, verify, confirm, scheduled.
 */
export const DeleteAccountCard = ({
  context,
  contextError,
  onResumeHandled,
  refetch,
  resumeDeletion = false,
}: DeleteAccountCardProps) => {
  const { data: session } = authClient.useSession();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [state, dispatch] = useReducer(
    deletionReducer,
    resumeDeletion,
    initDeletionState
  );
  const { expectedUserId, keepProjectIds, open, password, step } = state;

  const sessionUserId = session?.user.id ?? null;
  const isDifferentAccount =
    expectedUserId !== null &&
    sessionUserId !== null &&
    sessionUserId !== expectedUserId;

  useEffect(() => {
    if (resumeDeletion) {
      onResumeHandled?.();
    }
  }, [onResumeHandled, resumeDeletion]);

  const refreshContext = async () => {
    await refetch();
  };

  const openDialog = () => {
    dispatch({ type: "open", userId: sessionUserId });
    void refetch();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen || step === "scheduled") {
      return;
    }
    dispatch({ type: "close" });
    clearPendingDeletion();
  };

  const handleDelete = async (confirmation: string): Promise<string | null> => {
    const data: DeleteAccountInput = { confirmation, keepProjectIds };
    if (password) {
      data.password = password;
    }

    try {
      const result = await deleteAccount({ data });
      clearPendingDeletion();
      // Sessions are already revoked on the server; this clears local state.
      await authClient.signOut().catch(() => null);
      if (result.status === "deleted") {
        window.location.assign("/");
        return null;
      }
      dispatch({ purgeAt: result.purgeAt, type: "scheduled" });
      return null;
    } catch (deleteError) {
      const message =
        deleteError instanceof Error && deleteError.message
          ? deleteError.message
          : "Could not delete your account.";
      if (VERIFICATION_ERROR_PATTERN.test(message)) {
        await refetch();
        dispatch({
          error: password ? message : null,
          type: "verification-failed",
        });
        return null;
      }
      return message;
    }
  };

  const expectedConfirmation = context?.username ?? session?.user.email ?? "";

  const renderStep = (): ReactNode => {
    if (contextError) {
      return <ContextError error={contextError} onRetry={() => refetch()} />;
    }
    if (!context) {
      return <ContextSkeleton />;
    }
    switch (step) {
      case "consequences": {
        return (
          <ConsequencesStep
            context={context}
            keepProjectIds={keepProjectIds}
            onCancel={() => handleOpenChange(false)}
            onContinue={() => dispatch({ step: "verify", type: "go" })}
            onToggleKeep={(projectId, keep) =>
              dispatch({ keep, projectId, type: "keep" })
            }
          />
        );
      }
      case "verify": {
        return (
          <VerifyStep
            context={context}
            initialPasswordError={state.passwordError}
            isDifferentAccount={isDifferentAccount}
            keepProjectIds={keepProjectIds}
            onBack={() => dispatch({ step: "consequences", type: "go" })}
            onRefresh={refreshContext}
            onVerified={(value) =>
              dispatch({ password: value, type: "verified" })
            }
            userId={expectedUserId ?? sessionUserId}
          />
        );
      }
      case "confirm": {
        return (
          <ConfirmStep
            expected={expectedConfirmation}
            mode={context.mode}
            onBack={() => dispatch({ step: "verify", type: "go" })}
            onSubmit={handleDelete}
          />
        );
      }
      case "scheduled": {
        return <ScheduledStep purgeAt={state.purgeAt ?? ""} />;
      }
      default: {
        return null;
      }
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h3
          className="text-foreground text-base font-semibold"
          id="delete-account-heading"
        >
          Delete account
        </h3>
        <p className="text-muted-foreground max-w-prose text-sm">
          Removes your account, profile, and sign-in methods. If you own
          projects you will be asked what happens to each one first.
        </p>
      </div>

      <div>
        <Button
          type="button"
          variant="destructive"
          className="min-h-11 sm:px-6"
          onClick={openDialog}
        >
          <IconTrash size={16} stroke={1.8} aria-hidden="true" />
          Delete account
        </Button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          initialFocus={headingRef}
          showCloseButton={step !== "scheduled"}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>Delete your account</DialogTitle>
            <DialogDescription>
              Review what happens, confirm it’s you, then confirm the deletion.
            </DialogDescription>
          </DialogHeader>

          <StepHeading key={step} headingRef={headingRef} step={step} />
          {renderStep()}
        </DialogContent>
      </Dialog>
    </div>
  );
};
