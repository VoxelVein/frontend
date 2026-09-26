import { useForm, useStore } from "@tanstack/react-form";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { fallback, object, optional, parse, string } from "valibot";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { UsernameField } from "@/components/username-field";
import {
  usernameSchema,
  useUsernameAvailability,
} from "@/hooks/use-username-availability";
import { confirmUsername, suggestUsername } from "@/lib/account.functions";
import { authClient } from "@/lib/auth-client";
import { getSession } from "@/lib/auth.functions";
import { getSafeRedirect } from "@/lib/safe-redirect";

const DEFAULT_DESTINATION = "/dashboard";

// A malformed redirect is dropped rather than failing the page.
const welcomeSearchSchema = object({
  redirect: optional(fallback(string(), "")),
});

const WelcomePage = () => {
  const router = useRouter();
  // oxlint-disable-next-line no-use-before-define -- Route must be exported after the component for TanStack Router; WelcomePage only executes after Route is initialized
  const suggestion = Route.useLoaderData();
  // oxlint-disable-next-line no-use-before-define -- Route must be exported after the component for TanStack Router; WelcomePage only executes after Route is initialized
  const { redirect: redirectTo } = Route.useSearch();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { username: suggestion },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await confirmUsername({ data: { username: value.username.trim() } });
      } catch (error) {
        setFormError(
          error instanceof Error
            ? error.message
            : "Could not save your username."
        );
        return;
      }

      authClient.$store.notify("$sessionSignal");
      await router.invalidate();
      await router.navigate({
        href: getSafeRedirect(redirectTo, DEFAULT_DESTINATION),
      });
    },
    onSubmitInvalid: () => {
      setFormError(null);
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const username = useStore(form.store, (state) => state.values.username);
  const availability = useUsernameAvailability(username);

  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Choose your username
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Your username is shown on your projects and you can use it to sign in.
          You can change it later, but after a change it stays locked for 14
          days.
        </p>

        {formError ? (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive mt-6 rounded-lg border px-3 py-2.5 text-sm"
          >
            {formError}
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
          noValidate
          aria-busy={isSubmitting}
          className="mt-6 grid gap-4"
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
                id="welcome-username"
                label="Username"
                autoComplete="username"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
                helperText="3-30 characters. Letters, numbers, underscores, and periods."
                availability={availability}
                required
              />
            )}
          </form.Field>

          <Button
            type="submit"
            variant="default"
            size="lg"
            className="mt-2 min-h-11 w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner className="mr-1.5" label="Saving username" />
                Saving…
              </>
            ) : (
              "Confirm username"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/welcome")({
  validateSearch: (search: Record<string, string | undefined>) =>
    parse(welcomeSearchSchema, search),
  beforeLoad: async ({ search }) => {
    const session = await getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    if (session.user.usernameConfirmed !== false) {
      throw redirect({
        href: getSafeRedirect(search.redirect, DEFAULT_DESTINATION),
      });
    }
    return { session };
  },
  loader: () => suggestUsername(),
  head: () => ({
    meta: [{ title: "Choose your username — VoxelVein" }],
  }),
  component: WelcomePage,
});
