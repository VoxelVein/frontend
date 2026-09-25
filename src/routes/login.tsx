import { useForm, useStore } from "@tanstack/react-form";
import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { useRef, useState } from "react";
import { check, nonEmpty, pipe, regex, string } from "valibot";

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

const emailSchema = pipe(
  string(),
  check((value) => value.trim().length > 0, "Email is required."),
  regex(EMAIL_PATTERN, "Enter a valid email address.")
);

const usernameSchema = pipe(
  string(),
  check((value) => value.trim().length > 0, "Username is required."),
  check((value) => value.length >= 3, "Username must be at least 3 characters.")
);

const passwordSchema = pipe(string(), nonEmpty("Password is required."));

const MISSING_VERIFICATION_MESSAGE =
  "Complete the human verification check before signing in.";

type LoginMode = "email" | "username";

const LoginPage = () => {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<LoginMode>("email");
  // A ref, not state: useForm keeps the onSubmit from the first render, so
  // state read there would always be the initial null.
  const turnstileTokenRef = useRef<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const handleTurnstileToken = (token: string | null) => {
    turnstileTokenRef.current = token;
  };

  const form = useForm({
    defaultValues: {
      email: "",
      username: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      const turnstileToken = turnstileTokenRef.current;
      if (isTurnstileEnabled() && !turnstileToken) {
        setFormError(MISSING_VERIFICATION_MESSAGE);
        return;
      }

      const fetchOptions = turnstileFetchOptions(turnstileToken);
      const { error } =
        loginMode === "email"
          ? await authClient.signIn.email({
              email: value.email,
              fetchOptions,
              password: value.password,
            })
          : await authClient.signIn.username({
              fetchOptions,
              password: value.password,
              username: value.username,
            });

      if (error) {
        // Turnstile tokens are single-use, so every retry needs a fresh one.
        turnstileRef.current?.reset();
        const fallback =
          loginMode === "email"
            ? "Invalid email or password."
            : "Invalid username or password.";
        setFormError(error.message ?? fallback);
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

        <fieldset className="mt-6" aria-label="Login method">
          <legend className="sr-only">Login method</legend>
          <div className="bg-muted flex rounded-lg p-1">
            <Button
              type="button"
              variant={loginMode === "email" ? "default" : "ghost"}
              size="sm"
              className="min-h-10 flex-1"
              onClick={() => setLoginMode("email")}
              aria-pressed={loginMode === "email"}
            >
              Email
            </Button>
            <Button
              type="button"
              variant={loginMode === "username" ? "default" : "ghost"}
              size="sm"
              className="min-h-10 flex-1"
              onClick={() => setLoginMode("username")}
              aria-pressed={loginMode === "username"}
            >
              Username
            </Button>
          </div>
        </fieldset>

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
          {loginMode === "email" ? (
            <form.Field
              name="email"
              validators={{
                onChange: emailSchema,
                onSubmit: emailSchema,
              }}
            >
              {(field) => (
                <FormField
                  id="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com…"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors[0]?.message}
                  required
                />
              )}
            </form.Field>
          ) : (
            <form.Field
              name="username"
              validators={{
                onChange: usernameSchema,
                onSubmit: usernameSchema,
              }}
            >
              {(field) => (
                <FormField
                  id="username"
                  label="Username"
                  type="text"
                  autoComplete="username"
                  placeholder="yourusername…"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors[0]?.message}
                  required
                />
              )}
            </form.Field>
          )}

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
