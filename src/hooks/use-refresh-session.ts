import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

import { authClient } from "@/lib/auth-client";

/**
 * Tells the rest of the app that the signed-in account changed.
 *
 * Settings writes to the account — the name, the bio, the profile picture — and
 * every one of those is read from `users.image` or the session user by surfaces
 * that are not the settings page: the navbar, the account menu, and the public
 * profile. Refetching inside the settings component is not enough, because those
 * surfaces read a *cached* session.
 *
 * Both halves are needed:
 *
 * * `notify("$sessionSignal")` is what invalidates that cache. Calling
 *   `authClient.getSession()` directly fetches the fresh session and then throws
 *   it away — the nanostore the navbar's `useSession()` subscribed to is never
 *   told, so the avatar stayed stale until a reload.
 * * `router.invalidate()` re-runs the loaders, so server-rendered surfaces pick
 *   the change up on the next navigation rather than the next full page load.
 *
 * One hook rather than a copy per settings card, because the bug it prevents is
 * silent: a card that fetches without notifying still saves correctly and only
 * fails to repaint.
 */
const useRefreshSession = () => {
  const router = useRouter();

  return useCallback(async () => {
    authClient.$store.notify("$sessionSignal");
    await router.invalidate();
  }, [router]);
};

export { useRefreshSession };
