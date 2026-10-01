import { useForm, useStore } from "@tanstack/react-form";
import { useState } from "react";
import { check, minLength, nonEmpty, pipe, string } from "valibot";

import { FormField } from "@/components/form-field";
import { AlertDescription, Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  Card,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

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

/**
 * Changing the password of an account that has one.
 *
 * This was the first card in the danger zone, under a heading that said
 * "Irreversible actions for your account". Changing a password is neither
 * irreversible nor dangerous, and it sits next to sign-in methods and
 * passkeys where a user goes looking for it.
 *
 * Accounts without a password are handled by SettingsSignInMethods, which
 * already offers to set one.
 */
export const ChangePasswordCard = () => {
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
            Password
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
