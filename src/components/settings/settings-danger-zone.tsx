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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

interface SettingsDangerZoneProps {
  onSignOut: () => void;
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

const deletePasswordSchema = pipe(
  string(),
  nonEmpty("Enter your password to confirm.")
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

const DeleteAccountCard = ({ onSignOut }: SettingsDangerZoneProps) => {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteForm = useForm({
    defaultValues: {
      password: "",
    },
    onSubmit: async ({ value }) => {
      setError(null);
      const { error: deleteError } = await authClient.deleteUser({
        password: value.password,
      });
      if (deleteError) {
        setError(deleteError.message ?? "Could not delete your account.");
        return;
      }
      window.location.assign("/");
    },
    onSubmitInvalid: () => {
      setError(null);
    },
  });

  const isDeleting = useStore(deleteForm.store, (state) => state.isSubmitting);

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
              onClick={() => setDeleteOpen(true)}
            >
              Delete Account
            </Button>
          </div>

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete your account?</DialogTitle>
                <DialogDescription>
                  This permanently removes your account, profile, and all
                  associated data. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void deleteForm.handleSubmit();
                }}
                noValidate
                className="grid gap-4"
              >
                <deleteForm.Field
                  name="password"
                  validators={{
                    onChange: deletePasswordSchema,
                    onSubmit: deletePasswordSchema,
                  }}
                >
                  {(field) => (
                    <FormField
                      id="delete-password"
                      label="Enter your password to confirm"
                      type="password"
                      autoComplete="current-password"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      onBlur={field.handleBlur}
                      error={
                        field.state.meta.errors[0]?.message ??
                        error ??
                        undefined
                      }
                      required
                    />
                  )}
                </deleteForm.Field>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setDeleteOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    className="min-h-11"
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting…" : "Delete Account"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </section>
  );
};

const SettingsDangerZone = ({ onSignOut }: SettingsDangerZoneProps) => (
  <div className="grid gap-6">
    <ChangePasswordCard />
    <DeleteAccountCard onSignOut={onSignOut} />
  </div>
);

export { SettingsDangerZone };
