import { authClient } from "@/lib/auth-client";
import { can } from "@/lib/roles";

/**
 * Whether the signed-in account may manage blog posts.
 *
 * Drives the "New post" and "Edit" affordances on the reader-facing blog pages.
 * The admin routes themselves carry the real guards; this only decides whether
 * the shortcut is drawn, so a stale client-side session can over- or
 * under-expose the link without ever skipping the server's check.
 */
export const useCanManagePosts = (): boolean => {
  const { data: session } = authClient.useSession();
  return can(session?.user.role, "managePosts");
};
