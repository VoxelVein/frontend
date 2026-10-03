import { useForm, useStore } from "@tanstack/react-form";
import { useDebouncedValue } from "@tanstack/react-pacer/debouncer";
import { toast } from "sonner";
import { check, pipe, string } from "valibot";

import { FormField } from "@/components/form-field";
import { FormTextarea } from "@/components/form-textarea";
import { MarkdownBody } from "@/components/markdown-body";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { UsernameField } from "@/components/username-field";
import { useRefreshSession } from "@/hooks/use-refresh-session";
import {
  usernameSchema,
  useUsernameAvailability,
} from "@/hooks/use-username-availability";
import { changeUsername, confirmUsername } from "@/lib/account.functions";
import { authClient } from "@/lib/auth-client";
import { BIO_MAX_LENGTH, bioSchema, normalizeBio } from "@/lib/bio";
import { errorMessage } from "@/lib/form-errors";
import { formatDate } from "@/lib/format";
import { getNextUsernameChange, USERNAME_HINT } from "@/lib/usernames";

interface SettingsProfileUser {
  name: string;
  bio?: string | null;
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

/**
 * How long typing settles before the preview re-renders.
 *
 * The preview parses and sanitises Markdown on every change, which is far more
 * work per keystroke than the field itself. Waiting a third of a second keeps
 * typing smooth and the preview still feels live.
 */
const BIO_PREVIEW_DEBOUNCE_MS = 300;

const BIO_HELPER = "Markdown is supported. Shown on your public profile.";

/**
 * The bio field's helper, with the remaining characters counted in.
 *
 * The cap is a hard 500 enforced on change, so the error appears the moment it
 * is passed — but an error only says "too long" after the fact. The count says
 * how close the limit is while there is still room to act on it.
 */
const bioHelper = (value: string): string => {
  const remaining = BIO_MAX_LENGTH - value.length;

  if (remaining < 0) {
    return `${BIO_HELPER} ${Math.abs(remaining)} characters over the limit.`;
  }

  return `${BIO_HELPER} ${remaining} characters left.`;
};

/**
 * The bio as it will appear on the public profile.
 *
 * Rendered through the same `MarkdownBody` the profile uses, with the same
 * typography wrapper, because the alternative is guessing. The field shows
 * `**bold**` and a raw URL; the profile shows a bold run and a link, and the
 * only way to know which you got was to save and go and look.
 *
 * Rendered even when the field is empty, so the panel does not appear and
 * disappear as the field is filled and cleared.
 */
const BioPreview = ({ bio }: { bio: string }) => (
  <div className="grid gap-2">
    <p className="text-foreground text-sm font-medium">Preview</p>
    <div className="border-border bg-muted/30 min-h-24 rounded-lg border p-4">
      {bio.trim().length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Your bio will appear here. A sentence or two about what you work on is
          plenty.
        </p>
      ) : (
        // The same class the profile wraps the bio in, so the preview and the
        // page are not merely similar but identical.
        <div className="markdown-body max-w-prose">
          <MarkdownBody>{bio}</MarkdownBody>
        </div>
      )}
    </div>
  </div>
);

const USERNAME_CHANGE_NOTE =
  "After changing, you can't change it again for 14 days. Your old username keeps working for sign-in for 14 days.";

const USERNAME_NOTE_ID = "profile-username-note";

const DisplayNameCard = ({ user }: SettingsProfileProps) => {
  const refreshSession = useRefreshSession();

  // Fields are initialized from the session user and become the source of
  // truth; TanStack Form only re-syncs defaultValues while the form is
  // untouched, so the session prop never overwrites in-progress edits.
  const form = useForm({
    defaultValues: { bio: user.bio ?? "", name: user.name },
    onSubmit: async ({ value }) => {
      toast.dismiss();
      // Only the name and the bio: usernames go through their own server
      // functions, which enforce the cooldown and reservations.
      const { error } = await authClient.updateUser({
        // A cleared field stores null rather than "", so "no bio" stays
        // distinguishable from a bio that happens to render as nothing.
        bio: normalizeBio(value.bio),
        name: value.name.trim(),
      });
      if (error) {
        toast.error(error.message ?? "Could not update your profile.");
        return;
      }
      toast.success("Profile updated.");
      // Rebased onto what was *stored*, not what was typed: the name is trimmed
      // and the bio normalised on the way in, so resetting to the raw values
      // would clear the dirty flag while leaving whitespace in the field that
      // the server no longer has.
      form.reset({
        bio: normalizeBio(value.bio) ?? "",
        name: value.name.trim(),
      });
      await refreshSession();
    },
    onSubmitInvalid: () => {
      toast.dismiss();
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const isDirty = useStore(form.store, (state) => state.isDirty);
  const bio = useStore(form.store, (state) => state.values.bio);
  // The preview re-parses and re-sanitises Markdown on every change, which is far
  // more work per keystroke than the field itself, so it trails the typing.
  const [debouncedBio] = useDebouncedValue(bio, {
    wait: BIO_PREVIEW_DEBOUNCE_MS,
  });

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
          <CardDescription>Update your display name and bio.</CardDescription>
        </CardHeader>

        <CardContent>
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
              name="bio"
              validators={{
                onChange: bioSchema,
                onSubmit: bioSchema,
              }}
            >
              {(field) => (
                <>
                  <FormTextarea
                    id="profile-bio"
                    label="Bio (Markdown)"
                    rows={4}
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    error={field.state.meta.errors[0]?.message}
                    helperText={bioHelper(field.state.value)}
                  />
                  <BioPreview bio={debouncedBio} />
                </>
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

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                variant="default"
                className="min-h-11 w-full sm:w-auto sm:px-6"
                // Disabled with nothing to save: a button that is always live
                // invites a click that reports success without having changed
                // anything.
                disabled={isSubmitting || !isDirty}
              >
                {isSubmitting ? "Saving…" : "Save Changes"}
              </Button>

              {/* Said rather than signalled by the disabled button alone, which
                  tells a keyboard user nothing about why. */}
              {isDirty ? (
                <p className="text-muted-foreground text-sm">
                  You have unsaved changes.
                </p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
};

const UsernameCard = ({ user }: SettingsProfileProps) => {
  const refreshSession = useRefreshSession();

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
      toast.dismiss();
      const username = value.username.trim();
      if (username === currentUsername) {
        toast.success("That is already your username.");
        return;
      }
      try {
        await (isFirstChoice
          ? confirmUsername({ data: { username } })
          : changeUsername({ data: { username } }));
      } catch (error) {
        toast.error(errorMessage(error, "Could not change your username."));
        return;
      }
      toast.success("Username updated.");
      await refreshSession();
    },
    onSubmitInvalid: () => {
      // A retry after a failed submit should not leave the old error up.
      toast.dismiss();
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
                  helperText={lockedMessage ?? USERNAME_HINT}
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
