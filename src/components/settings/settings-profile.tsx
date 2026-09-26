import { useForm, useStore } from "@tanstack/react-form";
import { useState } from "react";
import { check, maxLength, minLength, pipe, regex, string } from "valibot";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

interface SettingsProfileProps {
  user: {
    name: string;
    email?: string | null;
    username?: string | null;
  };
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/u;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;

const nameSchema = pipe(
  string(),
  check((value) => value.trim().length > 0, "Name is required.")
);

const usernameSchema = pipe(
  string(),
  check((value) => value.trim().length > 0, "Username is required."),
  minLength(MIN_USERNAME_LENGTH, "Username must be 3-30 characters."),
  maxLength(MAX_USERNAME_LENGTH, "Username must be 3-30 characters."),
  regex(USERNAME_PATTERN, "Use letters, numbers, underscores, or periods.")
);

const SettingsProfile = ({ user }: SettingsProfileProps) => {
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fields are initialized from the session user and become the source of
  // truth; TanStack Form only re-syncs defaultValues while the form is
  // untouched, so the session prop never overwrites in-progress edits.
  const form = useForm({
    defaultValues: {
      name: user.name,
      username: user.username ?? "",
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      setSuccess(false);
      const { error } = await authClient.updateUser({
        displayUsername: value.username.trim(),
        name: value.name.trim(),
        username: value.username.trim(),
      });
      if (error) {
        setFormError(error.message ?? "Could not update your profile.");
        return;
      }
      setSuccess(true);
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
          <CardDescription>
            Update your display name and username.
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

            <form.Field
              name="username"
              validators={{
                onChange: usernameSchema,
                onSubmit: usernameSchema,
              }}
            >
              {(field) => (
                <FormField
                  id="profile-username"
                  label="Username"
                  type="text"
                  autoComplete="username"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors[0]?.message}
                  helperText="3-30 characters. Letters, numbers, underscores, and periods."
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

export { SettingsProfile };
