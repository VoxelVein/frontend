import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { projects, users } from "@/db/schema";
import { buildProjectDocuments } from "@/lib/project-document";
import type { ProjectDocument } from "@/lib/projects";
import { normalizeUsername } from "@/lib/usernames";

export interface PublicProfile {
  bio: string | null;
  displayUsername: string;
  /** The account's avatar, or null when they have not set one. */
  image: string | null;
  joinedAt: string;
  name: string;
  projects: ProjectDocument[];
  username: string;
}

/**
 * A user's public profile, or null when there is nothing to show.
 *
 * The profile is keyed on `users.username` rather than `users.displayUsername`
 * because only `username` is unique and normalised; `displayUsername` is the
 * same name in whatever casing the user chose, so it cannot identify anyone.
 * The requested name is normalised first, so `/u/Ada` and `/u/ada` are one
 * profile rather than two.
 *
 * An account that has asked to be deleted resolves to null. Its projects are
 * already hidden individually, but the bio and display name should not outlive
 * the request either.
 *
 * Only published projects are listed, so a creator's drafts and anything still
 * waiting for review stay off their public profile.
 */
export const loadPublicProfile = async (
  requestedUsername: string
): Promise<PublicProfile | null> => {
  const requested = normalizeUsername(requestedUsername);
  if (requested.length === 0) {
    return null;
  }

  const [user] = await db
    .select({
      bio: users.bio,
      createdAt: users.createdAt,
      displayUsername: users.displayUsername,
      id: users.id,
      image: users.image,
      name: users.name,
      username: users.username,
    })
    .from(users)
    .where(
      and(eq(users.username, requested), isNull(users.deletionRequestedAt))
    )
    .limit(1);

  if (!user) {
    return null;
  }

  const owned = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.ownerId, user.id),
        eq(projects.status, "published"),
        eq(projects.pendingDeletion, false)
      )
    )
    .orderBy(desc(projects.updatedAt));

  return {
    bio: user.bio,
    // Falls back to the normalised username, which is what the URL already
    // resolved on, so the heading is never empty.
    displayUsername: user.displayUsername ?? user.username ?? requested,
    image: user.image ?? null,
    joinedAt: user.createdAt.toISOString(),
    name: user.name,
    // Visibility is re-checked by the builder, so a project that changes state
    // between the two queries cannot slip onto a public page.
    projects: await buildProjectDocuments(owned.map((project) => project.id)),
    username: user.username ?? requested,
  };
};
