import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { projects, users } from "@/db/schema";
import { buildProjectDocuments } from "@/lib/project-document";
import type { ProjectDocument } from "@/lib/projects";
import { normalizeUsername } from "@/lib/usernames";

export interface PublicProfile {
  bio: string | null;
  displayUsername: string;
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
 * The requested name is normalised first, which makes `/u/Matt` and `/u/matt`
 * the same profile.
 *
 * An account that has asked to be deleted resolves to null. Its projects are
 * already hidden individually, but the bio and display name should not outlive
 * the request either.
 *
 * Only published projects are listed, so a creator's drafts and projects still
 * waiting for review stay off their public profile.
 */
export const getPublicProfile = createServerFn({ method: "GET" })
  .validator((data: { username: string }) => data)
  .handler(async ({ data }): Promise<PublicProfile | null> => {
    const requested = normalizeUsername(data.username);
    if (requested.length === 0) {
      return null;
    }

    const [user] = await db
      .select({
        bio: users.bio,
        createdAt: users.createdAt,
        displayUsername: users.displayUsername,
        id: users.id,
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
      displayUsername: user.displayUsername ?? user.username ?? requested,
      joinedAt: user.createdAt.toISOString(),
      name: user.name,
      // Visibility is re-checked by the builder, so a project that changed
      // state between the two queries cannot slip onto a public page.
      projects: await buildProjectDocuments(owned.map((project) => project.id)),
      username: user.username ?? requested,
    };
  });
