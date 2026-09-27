import { createServerFn } from "@tanstack/react-start";

import { loadPublicProfile } from "@/lib/user-profiles";

// SAFETY: the type is only re-exported, never re-declared, so it cannot drift
// from the one the handler is checked against.
export type { PublicProfile } from "@/lib/user-profiles";

/**
 * A user's public profile, or null when there is no such account.
 *
 * A thin wrapper over `loadPublicProfile` so the lookup stays testable outside a
 * request, matching how the project moderation functions are split.
 */
export const getPublicProfile = createServerFn({ method: "GET" })
  .validator((data: { username: string }) => data)
  .handler(({ data }) => loadPublicProfile(data.username));
