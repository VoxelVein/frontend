import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

/**
 * Signs out and settles the router/session caches.
 *
 * Both the navbar and the floating account button need this exact sequence: a
 * failed sign-out stays on the page with a retry, and a successful one refetches
 * the session before navigating home so the old avatar does not linger.
 */
const useSignOut = () => {
  const router = useRouter();

  // A named function expression gives the retry action a stable reference to
  // itself without reading a variable while it is still being initialized.
  return useCallback(
    async function signOut(): Promise<void> {
      const retry = () => {
        void signOut();
      };

      try {
        const { error } = await authClient.signOut();

        if (error) {
          toast.error(error.message ?? "Could not sign you out.", {
            action: { label: "Try again", onClick: retry },
          });

          return;
        }
      } catch {
        toast.error("Could not sign you out.", {
          action: { label: "Try again", onClick: retry },
        });

        return;
      }

      authClient.$store.notify("$sessionSignal");
      await router.invalidate();
      await authClient.getSession();
      await router.navigate({ to: "/" });
    },
    [router]
  );
};

export { useSignOut };
