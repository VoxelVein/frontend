import { useForm, useStore } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { check, pipe, string } from "valibot";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { UsernameField } from "@/components/username-field";
import {
  usernameSchema,
  useUsernameAvailability,
} from "@/hooks/use-username-availability";
import { changeUsername, confirmUsername } from "@/lib/account.functions";
import { authClient } from "@/lib/auth-client";
import { formatDate } from "@/lib/format";
import { getNextUsernameChange } from "@/lib/usernames";

interface SettingsProfileUser {
  name: string;
  email?: string | null;
  username?: string | null;
  displayUsername?: string | null;
  usernameChangedAt?: Date | string | null;
  usernameConfirmed?: boolean | null;
}

interface SettingsProfileProps {
  user: SettingsProfileUser;
}

const nameSchema = pipe(
  string(),
  check((value) => value.trim().length > 0, "Name is required.")
);

const USERNAME_CHANGE_NOTE =
  "After changing, you can't change it again for 14 days. Your old username keeps working for sign-in for 14 days.";

const USERNAME_NOTE_ID = "profile-username-note";

/** Tells the rest of the app (header, route loaders) the session changed. */
const useRefreshSession = () => {
  const router = useRouter();
  return async () => {
    authClient.$store.notify("$sessionSignal");
    await router.invalidate();
  };
};

const DisplayNameCard = ({ user }: SettingsProfileProps) => {
  const refreshSession = useRefreshSession();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fields are initialized from the session user and become the source of
  // truth; TanStack Form only re-syncs defaultValues while the form is
  // untouched, so the session prop never overwrites in-progress edits.
  const form = useForm({
    defaultValues: { name: user.name },
    onSubmit: async ({ value }) => {
      setFormError(null);
      setSuccess(false);
      // Only the name: usernames go through their own server functions,
      // which enforce the cooldown and reservations.
      const { error } = await authClient.updateUser({
        name: value.name.trim(),
      });
      if (error) {
        setFormError(error.message ?? "Could not update your profile.");
        return;
      }
      setSuccess(true);
      await refreshSession();
    },
    onSubmitInvalid: () => {
      setFormError(null);
      setSuccess(false);
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <section aria-labelledby="settings-profile-heading">
      <Card>
        <CardHeader>
          {/* A real h2, not CardTitle: the primitive renders a div, and the
              heading hierarchy must survive. */}
          <h2
            id="settings-profile-heading"
            className="text-foreground text-lg font-semibold"
          >
            Profile
          </h2>
          <CardDescription>Update your display name.</CardDescription>
        </CardHeader>

        <CardContent>
          {formError ? (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          {success ? (
            <Alert className="mt-4">
              <AlertDescription>Profile updated.</AlertDescription>
            </Alert>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
            noValidate
            aria-busy={isSubmitting}
            className="mt-4 grid gap-4"
          >
            <form.Field
              name="name"
              validators={{
                onChange: nameSchema,
                onSubmit: nameSchema,
              }}
            >
              {(field) => (
                <FormField
                  id="profile-name"
                  label="Display name"
                  type="text"
                  autoComplete="name"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors[0]?.message}
                  required
                />
              )}
            </form.Field>

            {/* Read-only rather than a styled <p>: a real field keeps its label
                association and is announced as a field the user cannot change. */}
            <FormField
              id="profile-email"
              label="Email"
              type="email"
              value={user.email ?? ""}
              readOnly
              helperText="Contact support to change the address on your account."
            />

            <Button
              type="submit"
              variant="default"
              className="mt-1 min-h-11 w-full sm:w-auto sm:px-6"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving…" : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
};

const UsernameCard = ({ user }: SettingsProfileProps) => {
  const refreshSession = useRefreshSession();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const currentUsername = user.displayUsername ?? user.username ?? null;
  // Accounts from Google or GitHub that never confirmed their generated name
  // make a first-time choice, which has no cooldown.
  const isFirstChoice = user.usernameConfirmed === false;
  const nextChange = isFirstChoice
    ? null
    : getNextUsernameChange(user.usernameChangedAt);
  const isLocked = nextChange !== null;

  const form = useForm({
    defaultValues: { username: currentUsername ?? "" },
    onSubmit: async ({ value }) => {
      setFormError(null);
      setSuccess(null);
      const username = value.username.trim();
      if (username === currentUsername) {
        setSuccess("That is already your username.");
        return;
      }
      try {
        await (isFirstChoice
          ? confirmUsername({ data: { username } })
          : changeUsername({ data: { username } }));
      } catch (error) {
        setFormError(
          error instanceof Error
            ? error.message
            : "Could not change your username."
        );
        return;
      }
      setSuccess("Username updated.");
      await refreshSession();
    },
    onSubmitInvalid: () => {
      setFormError(null);
      setSuccess(null);
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const username = useStore(form.store, (state) => state.values.username);
  const availability = useUsernameAvailability(username, {
    currentUsername,
    enabled: !isLocked,
  });

  const lockedMessage = nextChange
    ? `You can change your username again on ${formatDate(nextChange.toISOString())}.`
    : null;

  return (
    <section aria-labelledby="settings-username-heading">
      <Card>
        <CardHeader>
          <h2
            id="settings-username-heading"
            className="text-foreground text-lg font-semibold"
          >
            Username
          </h2>
          <CardDescription>
            {currentUsername
              ? `Your username is ${currentUsername}. It is shown on your projects and works for sign-in.`
              : "Choose a username. It is shown on your projects and works for sign-in."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {formError ? (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          {success ? (
            <Alert className="mt-4">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
            noValidate
            aria-busy={isSubmitting}
            className="mt-4 grid gap-4"
          >
            <form.Field
              name="username"
              validators={{
                onChange: usernameSchema,
                onSubmit: usernameSchema,
              }}
            >
              {(field) => (
                <UsernameField
                  id="profile-username"
                  label="Username"
                  autoComplete="username"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors[0]?.message}
                  helperText={
                    lockedMessage ??
                    "3-30 characters. Letters, numbers, underscores, and periods."
                  }
                  availability={availability}
                  disabled={isLocked}
                  required
                />
              )}
            </form.Field>

            {isLocked ? null : (
              <>
                {isFirstChoice ? null : (
                  <p
                    id={USERNAME_NOTE_ID}
                    className="text-muted-foreground text-sm"
                  >
                    {USERNAME_CHANGE_NOTE}
                  </p>
                )}

                <Button
                  type="submit"
                  variant="default"
                  className="mt-1 min-h-11 w-full sm:w-auto sm:px-6"
                  aria-describedby={
                    isFirstChoice ? undefined : USERNAME_NOTE_ID
                  }
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving…" : "Change username"}
                </Button>
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </section>
  );
};

const SettingsProfile = ({ user }: SettingsProfileProps) => (
  <div className="grid gap-6">
    <DisplayNameCard user={user} />
    <UsernameCard user={user} />
  </div>
);

export { SettingsProfile };
