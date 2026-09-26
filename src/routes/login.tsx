import { useForm, useStore } from "@tanstack/react-form";
import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { useRef, useState } from "react";
import { check, nonEmpty, pipe, string } from "valibot";

import { FormField } from "@/components/form-field";
import { GitHubSignInButton } from "@/components/github-sign-in-button";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { TurnstileWidget } from "@/components/turnstile-widget";
import type { TurnstileWidgetHandle } from "@/components/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { getSession } from "@/lib/auth.functions";
import {
  isTurnstileEnabled,
  turnstileFetchOptions,
} from "@/lib/turnstile-client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const MIN_USERNAME_LENGTH = 3;

const MISSING_VERIFICATION_MESSAGE =
  "Complete the human verification check before signing in.";
const INVALID_CREDENTIALS_MESSAGE = "Invalid email, username, or password.";

/**
 * A single field accepts either identifier, and the `@` decides which one it
 * is. That is the only signal available: Better Auth exposes `signIn.email` and
 * `signIn.username` as separate calls, so the branch has to be made client-side.
 */
const isEmailIdentifier = (value: string) => value.includes("@");

/** Accepts an email address or a username, and names the failing one. */
const identifierSchema = pipe(
  string(),
  check((value) => value.trim().length > 0, "Email or username is required."),
  check(
    (value) => !isEmailIdentifier(value) || EMAIL_PATTERN.test(value),
    "Enter a valid email address."
  ),
  check(
    (value) =>
      isEmailIdentifier(value) || value.trim().length >= MIN_USERNAME_LENGTH,
    `Username must be at least ${MIN_USERNAME_LENGTH} characters.`
  )
);

const passwordSchema = pipe(string(), nonEmpty("Password is required."));

const LoginPage = () => {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  // A ref, not state: useForm keeps the onSubmit from the first render, so
  // state read there would always be the initial null.
  const turnstileTokenRef = useRef<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const handleTurnstileToken = (token: string | null) => {
    turnstileTokenRef.current = token;
  };

  const form = useForm({
    defaultValues: {
      identifier: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      const turnstileToken = turnstileTokenRef.current;
      if (isTurnstileEnabled() && !turnstileToken) {
        setFormError(MISSING_VERIFICATION_MESSAGE);
        return;
      }

      const identifier = value.identifier.trim();
      const fetchOptions = turnstileFetchOptions(turnstileToken);
      const { error } = isEmailIdentifier(identifier)
        ? await authClient.signIn.email({
            email: identifier,
            fetchOptions,
            password: value.password,
          })
        : await authClient.signIn.username({
            fetchOptions,
            password: value.password,
            username: identifier,
          });

      if (error) {
        // Turnstile tokens are single-use, so every retry needs a fresh one.
        turnstileRef.current?.reset();
        setFormError(error.message ?? INVALID_CREDENTIALS_MESSAGE);
        return;
      }

      router.navigate({ to: "/" });
    },
    onSubmitInvalid: () => {
      setFormError(null);
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Sign in to your VoxelVein account.
        </p>

        {formError ? (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive mt-6 rounded-lg border px-3 py-2.5 text-sm"
          >
            {formError}
          </div>
        ) : null}

        <div className="mt-6">
          <GoogleSignInButton />
          <GitHubSignInButton />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <hr className="bg-border h-px flex-1 border-0" />
          <span className="text-muted-foreground text-xs tracking-wide uppercase">
            or
          </span>
          <hr className="bg-border h-px flex-1 border-0" />
        </div>

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
            name="identifier"
            validators={{
              onChange: identifierSchema,
              onSubmit: identifierSchema,
            }}
          >
            {(field) => (
              <FormField
                id="identifier"
                label="Email or username"
                // Not type="email": the field also accepts usernames, and
                // `username` is the autocomplete token that pairs with
                // current-password in password managers.
                type="text"
                autoComplete="username"
                placeholder="you@example.com"
                helperText="Use your email address or username."
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
                required
              />
            )}
          </form.Field>

          <form.Field
            name="password"
            validators={{
              onChange: passwordSchema,
              onSubmit: passwordSchema,
            }}
          >
            {(field) => (
              <FormField
                id="password"
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]?.message}
                required
              />
            )}
          </form.Field>

          <TurnstileWidget
            ref={turnstileRef}
            action="login"
            onTokenChange={handleTurnstileToken}
          />

          <Button
            type="submit"
            variant="default"
            size="lg"
            className="mt-2 min-h-11 w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner className="mr-1.5" label="Signing in" />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link
            to="/signup"
            className="text-primary focus-visible:ring-ring rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const session = await getSession();
    if (session) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});
