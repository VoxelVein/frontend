import { IconFingerprint, IconKey } from "@tabler/icons-react";
import { useForm, useStore } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { check, minLength, nonEmpty, pipe, string } from "valibot";

import { FormField } from "@/components/form-field";
import {
  ACCOUNT_DELETION_CONTEXT_QUERY_KEY,
  getConfiguredSocialProviders,
  LINKED_ACCOUNTS_QUERY_KEY,
  useLinkedAccounts,
} from "@/components/settings/sign-in-providers";
import type {
  LinkedAccount,
  SocialProvider,
  SocialProviderId,
} from "@/components/settings/sign-in-providers";
import { AlertDescription, Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  Card,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { setPassword } from "@/lib/account.functions";
import { authClient } from "@/lib/auth-client";

type StatusMessage =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

const MIN_PASSWORD_LENGTH = 8;
const LINK_CALLBACK_URL = "/settings?tab=security";
const SET_PASSWORD_FORM_ID = "settings-set-password-form";
const ONLY_METHOD_HELPER_ID = "settings-only-method-helper";

const newPasswordSchema = pipe(
  string(),
  nonEmpty("New password is required."),
  minLength(MIN_PASSWORD_LENGTH, "Password must be at least 8 characters.")
);

interface SetPasswordFormProps {
  onDone: (message: string) => void;
}

const SetPasswordForm = ({ onDone }: SetPasswordFormProps) => {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { confirmPassword: "", newPassword: "" },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await setPassword({ data: { newPassword: value.newPassword } });
      } catch (submitError) {
        setFormError(
          submitError instanceof Error
            ? submitError.message
            : "Could not set your password."
        );
        return;
      }
      form.reset();
      onDone("Password set. You can now sign in with it.");
    },
  });

  const confirmPasswordSchema = pipe(
    string(),
    nonEmpty("Please confirm your new password."),
    check(
      (value) =>
        !form.state.values.newPassword ||
        value === form.state.values.newPassword,
      "Passwords do not match."
    )
  );

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <form
      id={SET_PASSWORD_FORM_ID}
      aria-label="Set a password"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      noValidate
      aria-busy={isSubmitting}
      className="border-border mt-3 grid gap-4 rounded-lg border p-4"
    >
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <form.Field
        name="newPassword"
        validators={{
          onChange: newPasswordSchema,
          onSubmit: newPasswordSchema,
        }}
      >
        {(field) => (
          <FormField
            id="set-new-password"
            label="New password"
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
      </form.Field>

      <form.Field
        name="confirmPassword"
        validators={{
          onChange: confirmPasswordSchema,
          onChangeListenTo: ["newPassword"],
          onSubmit: confirmPasswordSchema,
        }}
      >
        {(field) => (
          <FormField
            id="set-confirm-password"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={field.state.value}
            onChange={(event) => field.handleChange(event.target.value)}
            onBlur={field.handleBlur}
            error={field.state.meta.errors[0]?.message}
            required
          />
        )}
      </form.Field>

      <Button
        type="submit"
        variant="default"
        className="min-h-11 w-full sm:w-auto sm:justify-self-start sm:px-6"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Spinner className="mr-1" />
            Saving…
          </>
        ) : (
          "Save password"
        )}
      </Button>
    </form>
  );
};

interface MethodRowProps {
  icon: ComponentType<{ "aria-hidden"?: boolean; size?: number }>;
  label: string;
  status: string;
  children?: ReactNode;
}

const MethodRow = ({ icon: Icon, label, status, children }: MethodRowProps) => (
  <li className="border-border bg-muted/40 grid gap-3 rounded-lg border p-3">
    <div className="flex flex-wrap items-center gap-3">
      <span
        aria-hidden="true"
        className="border-border bg-background text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border"
      >
        <Icon aria-hidden size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">{status}</p>
      </div>
      {children}
    </div>
  </li>
);

const SettingsSignInMethods = () => {
  const queryClient = useQueryClient();
  const {
    data: accounts,
    error: listError,
    isPending,
    refetch,
  } = useLinkedAccounts();
  const [status, setStatus] = useState<StatusMessage>({ type: "idle" });
  const [busyProvider, setBusyProvider] = useState<SocialProviderId | null>(
    null
  );
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const providers = getConfiguredSocialProviders();
  const hasPassword =
    accounts?.some((account) => account.providerId === "credential") ?? false;
  const isOnlyAccount = (accounts?.length ?? 0) <= 1;

  const refreshAccounts = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: LINKED_ACCOUNTS_QUERY_KEY }),
      queryClient.invalidateQueries({
        queryKey: ACCOUNT_DELETION_CONTEXT_QUERY_KEY,
      }),
    ]);
  };

  const handleLink = async (provider: SocialProvider) => {
    setStatus({ type: "idle" });
    setBusyProvider(provider.id);
    const { error } = await authClient.linkSocial({
      callbackURL: LINK_CALLBACK_URL,
      provider: provider.id,
    });
    setBusyProvider(null);
    if (error) {
      setStatus({
        message: error.message ?? `Could not link ${provider.label}.`,
        type: "error",
      });
    }
  };

  const handleUnlink = async (
    provider: SocialProvider,
    account: LinkedAccount
  ) => {
    setStatus({ type: "idle" });
    setBusyProvider(provider.id);
    // Better Auth identifies the link by its own account row id.
    const { error } = await authClient.unlinkAccount({ accountId: account.id });
    setBusyProvider(null);
    if (error) {
      setStatus({
        message: error.message ?? `Could not unlink ${provider.label}.`,
        type: "error",
      });
      return;
    }
    setStatus({ message: `${provider.label} unlinked.`, type: "success" });
    await refreshAccounts();
  };

  const handlePasswordSet = async (message: string) => {
    setShowPasswordForm(false);
    setStatus({ message, type: "success" });
    await refreshAccounts();
  };

  return (
    <section aria-labelledby="settings-sign-in-methods-heading">
      <Card>
        <CardHeader>
          <h2
            id="settings-sign-in-methods-heading"
            className="text-foreground text-lg font-semibold"
          >
            Sign-in methods
          </h2>
          <CardDescription>
            Choose how you sign in to VoxelVein. Keep at least one method.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {listError ? (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{listError.message}</span>
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
          ) : null}

          {status.type === "error" ? (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{status.message}</AlertDescription>
            </Alert>
          ) : null}

          {/* Always mounted so screen readers announce the message on change. */}
          <p
            aria-live="polite"
            className={
              status.type === "success"
                ? "text-foreground mt-4 text-sm"
                : "sr-only"
            }
          >
            {status.type === "success" ? status.message : ""}
          </p>

          {isPending ? (
            <div aria-busy="true" className="mt-4 grid gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : null}

          {accounts ? (
            <ul className="mt-4 grid gap-3">
              <MethodRow
                icon={IconKey}
                label="Password"
                status={hasPassword ? "Set" : "Not set"}
              >
                {hasPassword ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    aria-expanded={showPasswordForm}
                    aria-controls={SET_PASSWORD_FORM_ID}
                    onClick={() => setShowPasswordForm((open) => !open)}
                  >
                    Set password
                  </Button>
                )}
              </MethodRow>

              {providers.map((provider) => {
                const account = accounts.find(
                  (item) => item.providerId === provider.id
                );
                const isBusy = busyProvider === provider.id;

                return (
                  <MethodRow
                    key={provider.id}
                    icon={provider.icon}
                    label={provider.label}
                    status={account ? "Linked" : "Not linked"}
                  >
                    {account ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        disabled={isOnlyAccount || isBusy}
                        aria-describedby={
                          isOnlyAccount ? ONLY_METHOD_HELPER_ID : undefined
                        }
                        onClick={() => handleUnlink(provider, account)}
                      >
                        {isBusy ? <Spinner className="mr-1" /> : null}
                        Unlink {provider.label}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        disabled={isBusy}
                        onClick={() => handleLink(provider)}
                      >
                        {isBusy ? <Spinner className="mr-1" /> : null}
                        Link {provider.label}
                      </Button>
                    )}
                  </MethodRow>
                );
              })}

              <MethodRow
                icon={IconFingerprint}
                label="Passkeys"
                status="Manage passkeys below."
              />
            </ul>
          ) : null}

          {accounts && isOnlyAccount ? (
            <p
              id={ONLY_METHOD_HELPER_ID}
              className="text-muted-foreground mt-3 text-sm"
            >
              This is your only linked sign-in method, so it can’t be removed.
              Add a password or link another account first.
            </p>
          ) : null}

          {showPasswordForm && !hasPassword ? (
            <SetPasswordForm onDone={handlePasswordSet} />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
};

export { SettingsSignInMethods };
