import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { projects, projectVersions, users } from "@/db/schema";
import { DELETED_USER_LABEL } from "@/lib/projects";
import type { ProjectDocument } from "@/lib/projects";

const unique = (values: string[][]): string[] => [...new Set(values.flat())];

/**
 * Builds the project document the search and trending views share, or null when
 * the project is not publicly visible.
 *
 * `gameVersions` and `loaders` are the union across every version, because a
 * project is reachable from any version it supports, while `version` is only the
 * latest release.
 */
export const buildProjectDocument = async (
  projectId: string
): Promise<ProjectDocument | null> => {
  const [project] = await db
    .select({
      authorDisplayUsername: users.displayUsername,
      authorName: users.name,
      authorUsername: users.username,
      category: projects.category,
      downloads: projects.downloads,
      id: projects.id,
      name: projects.name,
      pendingDeletion: projects.pendingDeletion,
      slug: projects.slug,
      status: projects.status,
      summary: projects.summary,
      tags: projects.tags,
      type: projects.type,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    // Left join: a kept project whose owner deleted their account has none.
    .leftJoin(users, eq(users.id, projects.ownerId))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || project.status !== "published" || project.pendingDeletion) {
    return null;
  }

  const versions = await db
    .select({
      gameVersions: projectVersions.gameVersions,
      loaders: projectVersions.loaders,
      versionNumber: projectVersions.versionNumber,
    })
    .from(projectVersions)
    .where(eq(projectVersions.projectId, projectId))
    .orderBy(desc(projectVersions.createdAt));

  return {
    author:
      project.authorDisplayUsername ??
      project.authorUsername ??
      project.authorName ??
      DELETED_USER_LABEL,
    category: project.category,
    description: project.summary,
    downloads: project.downloads,
    gameVersions: unique(versions.map((version) => version.gameVersions)),
    id: project.id,
    loaders: unique(versions.map((version) => version.loaders)),
    name: project.name,
    slug: project.slug,
    tags: project.tags,
    type: project.type,
    updatedAt: project.updatedAt.toISOString(),
    version: versions[0]?.versionNumber ?? "",
  };
};
