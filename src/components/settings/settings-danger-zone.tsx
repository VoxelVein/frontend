import { IconCircleCheck, IconLock } from "@tabler/icons-react";
import { useForm, useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { FormEvent, RefObject } from "react";
import {
  array,
  check,
  minLength,
  nonEmpty,
  object,
  pipe,
  safeParse,
  string,
} from "valibot";

import { FormField } from "@/components/form-field";
import {
  ACCOUNT_DELETION_CONTEXT_QUERY_KEY,
  getConfiguredSocialProviders,
  useLinkedAccounts,
} from "@/components/settings/sign-in-providers";
import type { SocialProviderId } from "@/components/settings/sign-in-providers";
import { AlertDescription, AlertTitle, Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  CardContent,
  CardDescription,
  CardHeader,
  Card,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  deleteAccount,
  getAccountDeletionContext,
} from "@/lib/account.functions";
import type { AccountDeletionContext } from "@/lib/account.functions";
import { authClient } from "@/lib/auth-client";

interface SettingsDangerZoneProps {
  onSignOut: () => void;
  /** Called once a `confirm=delete` return from re-authentication is consumed. */
  onResumeHandled?: () => void;
  /** The page came back from a re-authentication redirect mid-deletion. */
  resumeDeletion?: boolean;
}

type PasswordFormStatus =
  | { type: "idle" }
  | { type: "success" }
  | { type: "error"; message: string };

const MIN_PASSWORD_LENGTH = 8;

const currentPasswordSchema = pipe(
  string(),
  nonEmpty("Current password is required.")
);

const newPasswordSchema = pipe(
  string(),
  nonEmpty("New password is required."),
  minLength(MIN_PASSWORD_LENGTH, "Password must be at least 8 characters.")
);

const ChangePasswordCard = () => {
  const [passwordStatus, setPasswordStatus] = useState<PasswordFormStatus>({
    type: "idle",
  });

  const passwordForm = useForm({
    defaultValues: {
      confirmPassword: "",
      currentPassword: "",
      newPassword: "",
    },
    onSubmit: async ({ value }) => {
      const { error: changeError } = await authClient.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        revokeOtherSessions: true,
      });
      if (changeError) {
        setPasswordStatus({
          message: changeError.message ?? "Could not change your password.",
          type: "error",
        });
        return;
      }
      passwordForm.reset();
      setPasswordStatus({ type: "success" });
    },
  });

  const confirmPasswordSchema = pipe(
    string(),
    nonEmpty("Please confirm your new password."),
    check(
      (value) =>
        !passwordForm.state.values.newPassword ||
        value === passwordForm.state.values.newPassword,
      "Passwords do not match."
    )
  );

  const isSubmitting = useStore(
    passwordForm.store,
    (state) => state.isSubmitting
  );

  return (
    <section aria-labelledby="settings-password-heading">
      <Card>
        <CardHeader>
          <h2
            id="settings-password-heading"
            className="text-foreground text-lg font-semibold"
          >
            Change Password
          </h2>
          <CardDescription>
            Update your password. Other sessions will be signed out.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {passwordStatus.type === "error" ? (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{passwordStatus.message}</AlertDescription>
            </Alert>
          ) : null}

          {passwordStatus.type === "success" ? (
            <Alert className="mt-4">
              <AlertDescription>Password updated.</AlertDescription>
            </Alert>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void passwordForm.handleSubmit();
            }}
            noValidate
            aria-busy={isSubmitting}
            className="mt-4 grid gap-4"
          >
            <passwordForm.Field
              name="currentPassword"
              validators={{
                onChange: currentPasswordSchema,
                onSubmit: currentPasswordSchema,
              }}
            >
              {(field) => (
                <FormField
                  id="current-password"
                  label="Current password"
                  placeholder="••••••••"
                  type="password"
                  autoComplete="current-password"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors[0]?.message}
                  required
                />
              )}
            </passwordForm.Field>

            <passwordForm.Field
              name="newPassword"
              validators={{
                onChange: newPasswordSchema,
                onSubmit: newPasswordSchema,
              }}
            >
              {(field) => (
                <FormField
                  id="new-password"
                  label="New password"
                  placeholder="••••••••"
                  type="password"
                  autoComplete="new-password"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors[0]?.message}
                  helperText="At least 8 characters."
                  required
                />
              )}
            </passwordForm.Field>

            <passwordForm.Field
              name="confirmPassword"
              validators={{
                onChange: confirmPasswordSchema,
                onChangeListenTo: ["newPassword"],
                onSubmit: confirmPasswordSchema,
              }}
            >
              {(field) => (
                <FormField
                  id="confirm-password"
                  label="Confirm new password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors[0]?.message}
                  required
                />
              )}
            </passwordForm.Field>

            <Button
              type="submit"
              variant="default"
              className="mt-1 min-h-11 w-full sm:w-auto sm:px-6"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Spinner className="mr-1" />
                  Updating…
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
};

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

const PENDING_DELETION_STORAGE_KEY = "voxelvein:pending-account-deletion";
const REAUTH_CALLBACK_URL = "/settings?tab=danger&confirm=delete";
const SCHEDULED_REDIRECT_DELAY_MS = 8000;
const VERIFICATION_ERROR_PATTERN = /password|confirm it's you/iu;

type DeletionStep = "consequences" | "verify" | "confirm" | "scheduled";

const STEP_TITLES: Record<DeletionStep, string> = {
  confirm: "Step 3 of 3: Confirm deletion",
  consequences: "Step 1 of 3: What happens",
  scheduled: "Deletion scheduled",
  verify: "Step 2 of 3: Confirm it’s you",
};

const pendingDeletionSchema = object({
  keepProjectIds: array(string()),
  userId: string(),
});

interface PendingDeletion {
  keepProjectIds: string[];
  userId: string;
}

/**
 * Social re-authentication leaves the page, so the choices made so far and
 * the account that started the deletion survive the round trip here.
 */
const readPendingDeletion = (): PendingDeletion | null => {
  try {
    const raw = window.sessionStorage.getItem(PENDING_DELETION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const result = safeParse(pendingDeletionSchema, JSON.parse(raw));
    return result.success ? result.output : null;
  } catch {
    return null;
  }
};

const writePendingDeletion = (pending: PendingDeletion) => {
  try {
    window.sessionStorage.setItem(
      PENDING_DELETION_STORAGE_KEY,
      JSON.stringify(pending)
    );
  } catch {
    // Storage can be unavailable (private mode); the flow still works, it
    // just can't detect a switch to a different account on return.
  }
};

const clearPendingDeletion = () => {
  try {
    window.sessionStorage.removeItem(PENDING_DELETION_STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
};

const purgeDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "long",
});

const useDeletionContext = () =>
  useQuery({
    queryFn: () => getAccountDeletionContext(),
    queryKey: ACCOUNT_DELETION_CONTEXT_QUERY_KEY,
  });

interface StepHeadingProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
  step: DeletionStep;
}

/**
 * Render with `key={step}`: each step mounts a fresh heading, which takes
 * focus so keyboard and screen reader users land at the start of the step.
 */
const StepHeading = ({ headingRef, step }: StepHeadingProps) => {
  const focusOnMount = useCallback(
    (node: HTMLHeadingElement | null) => {
      headingRef.current = node;
      node?.focus();
    },
    [headingRef]
  );

  return (
    <h3
      ref={focusOnMount}
      tabIndex={-1}
      className="text-foreground text-base font-semibold outline-none"
    >
      {STEP_TITLES[step]}
    </h3>
  );
};

interface ConsequencesStepProps {
  context: AccountDeletionContext;
  keepProjectIds: string[];
  onCancel: () => void;
  onContinue: () => void;
  onToggleKeep: (projectId: string, keep: boolean) => void;
}

const ConsequencesStep = ({
  context,
  keepProjectIds,
  onCancel,
  onContinue,
  onToggleKeep,
}: ConsequencesStepProps) => {
  const hasProtected = context.projects.some((project) => project.isProtected);
  const keptIds = new Set(keepProjectIds);

  return (
    <div className="grid gap-4">
      {context.mode === "immediate" ? (
        <p className="text-foreground text-sm">
          Your account, profile, and sign-in methods are deleted immediately and
          permanently. This cannot be undone.
        </p>
      ) : (
        <div className="grid gap-2 text-sm">
          <p className="text-foreground">
            Your account is deactivated right away and you are signed out
            everywhere. It is permanently deleted after 14 days.
          </p>
          <p className="text-muted-foreground">
            Until then, it can only be restored by contacting VoxelVein support.
          </p>
        </div>
      )}

      {context.projects.length > 0 ? (
        <div className="grid gap-3">
          <p className="text-foreground text-sm font-medium">
            Choose what happens to each of your projects.
          </p>
          <ul className="grid gap-3">
            {context.projects.map((project) => {
              const keep = keptIds.has(project.id);

              if (project.isProtected) {
                return (
                  <li
                    key={project.id}
                    className="border-border bg-muted/40 flex items-start gap-3 rounded-lg border p-3"
                  >
                    <IconLock
                      aria-hidden
                      size={18}
                      className="text-muted-foreground mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-foreground text-sm font-medium">
                        {project.name}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Kept — marked as a large project by the VoxelVein team
                      </p>
                    </div>
                  </li>
                );
              }

              return (
                <li key={project.id}>
                  <fieldset className="border-border grid gap-2 rounded-lg border p-3">
                    <legend className="text-foreground px-1 text-sm font-medium">
                      {project.name}
                    </legend>
                    <label className="hover:bg-muted/50 flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm transition-colors">
                      <input
                        type="radio"
                        name={`project-${project.id}`}
                        value="delete"
                        checked={!keep}
                        onChange={() => onToggleKeep(project.id, false)}
                        className="accent-primary size-4"
                      />
                      Delete with my account
                    </label>
                    <label className="hover:bg-muted/50 flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm transition-colors">
                      <input
                        type="radio"
                        name={`project-${project.id}`}
                        value="keep"
                        checked={keep}
                        onChange={() => onToggleKeep(project.id, true)}
                        className="accent-primary size-4"
                      />
                      Keep (published without an owner)
                    </label>
                  </fieldset>
                </li>
              );
            })}
          </ul>
          {hasProtected ? (
            <p className="text-muted-foreground text-sm">
              Large projects are always kept, and the VoxelVein team is notified
              so they can look after them.
            </p>
          ) : null}
        </div>
      ) : null}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="default"
          className="min-h-11"
          onClick={onContinue}
        >
          Continue
        </Button>
      </DialogFooter>
    </div>
  );
};

interface VerifyStepProps {
  context: AccountDeletionContext;
  initialPasswordError: string | null;
  isDifferentAccount: boolean;
  keepProjectIds: string[];
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onVerified: (password: string | null) => void;
  userId: string | null;
}

const VerifyStep = ({
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
          onClick={handlePasskey}
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
            onClick={() => handleSocial(provider.id)}
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
          onClick={onBack}
        >
          Back
        </Button>
      </DialogFooter>
    </div>
  );
};

interface ConfirmStepProps {
  expected: string;
  mode: AccountDeletionContext["mode"];
  onBack: () => void;
  onSubmit: (confirmation: string) => Promise<string | null>;
}

const ConfirmStep = ({
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

interface ScheduledStepProps {
  purgeAt: string;
}

const ScheduledStep = ({ purgeAt }: ScheduledStepProps) => {
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

interface DeleteAccountCardProps extends SettingsDangerZoneProps {
  contextQuery: UseQueryResult<AccountDeletionContext>;
}

interface DeleteAccountInput {
  confirmation: string;
  keepProjectIds: string[];
  password?: string;
}

interface DeletionState {
  /** The account that started the deletion, to detect a switch on re-auth. */
  expectedUserId: string | null;
  keepProjectIds: string[];
  open: boolean;
  /** Collected on step 2 and sent with the final request. */
  password: string | null;
  passwordError: string | null;
  purgeAt: string | null;
  step: DeletionStep;
}

type DeletionAction =
  | { type: "open"; userId: string | null }
  | { type: "close" }
  | { type: "go"; step: DeletionStep }
  | { type: "keep"; keep: boolean; projectId: string }
  | { type: "verified"; password: string | null }
  | { type: "verification-failed"; error: string | null }
  | { type: "scheduled"; purgeAt: string };

const closedDeletionState: DeletionState = {
  expectedUserId: null,
  keepProjectIds: [],
  open: false,
  password: null,
  passwordError: null,
  purgeAt: null,
  step: "consequences",
};

const deletionReducer = (
  state: DeletionState,
  action: DeletionAction
): DeletionState => {
  switch (action.type) {
    case "open": {
      return {
        ...closedDeletionState,
        expectedUserId: action.userId,
        open: true,
      };
    }
    case "close": {
      return { ...state, open: false };
    }
    case "go": {
      return { ...state, step: action.step };
    }
    case "keep": {
      const others = state.keepProjectIds.filter(
        (id) => id !== action.projectId
      );
      return {
        ...state,
        keepProjectIds: action.keep ? [...others, action.projectId] : others,
      };
    }
    case "verified": {
      return {
        ...state,
        password: action.password,
        passwordError: null,
        step: "confirm",
      };
    }
    case "verification-failed": {
      return {
        ...state,
        password: null,
        passwordError: action.error,
        step: "verify",
      };
    }
    case "scheduled": {
      return { ...state, purgeAt: action.purgeAt, step: "scheduled" };
    }
    default: {
      return state;
    }
  }
};

/**
 * Coming back from a social re-authentication (`confirm=delete`), reopen
 * the dialog where the user left it, with the choices made before leaving.
 */
const initDeletionState = (resumeDeletion: boolean): DeletionState => {
  if (!resumeDeletion) {
    return closedDeletionState;
  }
  const pending = readPendingDeletion();
  return {
    ...closedDeletionState,
    expectedUserId: pending?.userId ?? null,
    keepProjectIds: pending?.keepProjectIds ?? [],
    open: true,
    step: pending ? "verify" : "consequences",
  };
};

const DeleteAccountCard = ({
  contextQuery,
  onResumeHandled,
  onSignOut,
  resumeDeletion = false,
}: DeleteAccountCardProps) => {
  const { data: session } = authClient.useSession();
  const { data: context, error: contextError, refetch } = contextQuery;
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

  const renderStep = () => {
    if (contextError) {
      return (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {contextError.message || "Could not load your account."}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => refetch()}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      );
    }
    if (!context) {
      return (
        <div aria-busy="true" className="grid gap-3">
          <Skeleton className="h-6" />
          <Skeleton className="h-16" />
        </div>
      );
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
    <section aria-labelledby="settings-danger-heading">
      <Card>
        <CardHeader>
          <h2
            id="settings-danger-heading"
            className="text-destructive text-lg font-semibold"
          >
            Danger Zone
          </h2>
          <CardDescription>
            Irreversible actions for your account.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 sm:px-6"
              onClick={onSignOut}
            >
              Sign Out
            </Button>

            <Button
              type="button"
              variant="destructive"
              className="min-h-11 sm:px-6"
              onClick={openDialog}
            >
              Delete Account
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
                  Review what happens, confirm it’s you, then confirm the
                  deletion.
                </DialogDescription>
              </DialogHeader>

              <StepHeading key={step} headingRef={headingRef} step={step} />
              {renderStep()}
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </section>
  );
};

interface PasswordSectionProps {
  hasPassword: boolean | undefined;
}

const PasswordSection = ({ hasPassword }: PasswordSectionProps) => {
  if (hasPassword === undefined) {
    return <Skeleton aria-busy="true" className="h-40" />;
  }
  if (hasPassword) {
    return <ChangePasswordCard />;
  }
  return (
    <section aria-labelledby="settings-password-heading">
      <Card>
        <CardHeader>
          <h2
            id="settings-password-heading"
            className="text-foreground text-lg font-semibold"
          >
            Password
          </h2>
          <CardDescription>
            You sign in without a password. You can add one on the Security tab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href="/settings?tab=security"
            className={buttonVariants({
              className: "mt-2 min-h-11 sm:px-6",
              variant: "outline",
            })}
          >
            Go to Security
          </a>
        </CardContent>
      </Card>
    </section>
  );
};

const SettingsDangerZone = ({
  onResumeHandled,
  onSignOut,
  resumeDeletion,
}: SettingsDangerZoneProps) => {
  const contextQuery = useDeletionContext();

  return (
    <div className="grid gap-6">
      <PasswordSection
        hasPassword={
          contextQuery.isError ? true : contextQuery.data?.hasPassword
        }
      />
      <DeleteAccountCard
        contextQuery={contextQuery}
        onResumeHandled={onResumeHandled}
        onSignOut={onSignOut}
        resumeDeletion={resumeDeletion}
      />
    </div>
  );
};

export { SettingsDangerZone };
