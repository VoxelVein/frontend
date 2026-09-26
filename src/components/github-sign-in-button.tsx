import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

const GitHubIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="size-4"
    fill="currentColor"
  >
    <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.8 1.3 3.48.99.11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5Z" />
  </svg>
);

// SAFETY: Vite exposes VITE_* vars as `any`; narrowing to string | undefined
// matches the runtime value (string when set, undefined when absent).
const GITHUB_CLIENT_ID =
  (import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined) ?? "";

const isConfigured = (key: string): boolean => key.trim().length > 0;

const GitHubSignInButtonContent = () => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setIsPending(true);
    setError(null);

    const { error: signInError } = await authClient.signIn.social({
      callbackURL: "/",
      // New accounts get a generated username and choose their own first.
      newUserCallbackURL: "/welcome",
      provider: "github",
    });

    if (signInError) {
      setIsPending(false);
      setError(signInError.message ?? "Could not sign in with GitHub.");
    }
  };

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="min-h-11 w-full"
        disabled={isPending}
        onClick={handleSignIn}
      >
        <GitHubIcon />
        {isPending ? "Redirecting…" : "Continue with GitHub"}
      </Button>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
};

const GitHubSignInButton = () => {
  if (!isConfigured(GITHUB_CLIENT_ID)) {
    return null;
  }

  return <GitHubSignInButtonContent />;
};

export { GitHubSignInButton };
