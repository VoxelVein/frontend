import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { projects, projectVersions, users } from "@/db/schema";
import { DELETED_USER_LABEL } from "@/lib/projects";
import type { ProjectDocument } from "@/lib/projects";

const unique = (values: string[][]): string[] => [...new Set(values.flat())];

/**
 * Builds the project documents the search, trending and profile views share.
 *
 * Projects that are not publicly visible are dropped rather than returned as
 * nulls, so callers can use the result directly. Bulk takes ids because a
 * profile lists every project an author has, and one query per project would
 * make that page scale with the number of projects rather than staying flat.
 *
 * `gameVersions` and `loaders` are the union across every version, because a
 * project is reachable from any version it supports, while `version` is only
 * the latest release.
 */
export const buildProjectDocuments = async (
  projectIds: string[]
): Promise<ProjectDocument[]> => {
  if (projectIds.length === 0) {
    return [];
  }

  const rows = await db
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
    .where(inArray(projects.id, projectIds));

  const published = rows.filter(
    (row) => row.status === "published" && !row.pendingDeletion
  );

  if (published.length === 0) {
    return [];
  }

  const versions = await db
    .select({
      createdAt: projectVersions.createdAt,
      gameVersions: projectVersions.gameVersions,
      loaders: projectVersions.loaders,
      projectId: projectVersions.projectId,
      versionNumber: projectVersions.versionNumber,
    })
    .from(projectVersions)
    .where(
      inArray(
        projectVersions.projectId,
        published.map((row) => row.id)
      )
    )
    .orderBy(desc(projectVersions.createdAt));

  // Newest version first, so the first entry per project is its latest.
  const versionsByProject = new Map<string, typeof versions>();
  for (const version of versions) {
    const existing = versionsByProject.get(version.projectId);
    if (existing) {
      existing.push(version);
    } else {
      versionsByProject.set(version.projectId, [version]);
    }
  }

  return published.map((project) => {
    const projectVersionsForProject = versionsByProject.get(project.id) ?? [];
    return {
      author:
        project.authorDisplayUsername ??
        project.authorUsername ??
        project.authorName ??
        DELETED_USER_LABEL,
      // Null when the owner is gone, which is what keeps the byline from
      // linking to a profile that does not exist.
      authorUsername: project.authorUsername,
      category: project.category,
      description: project.summary,
      downloads: project.downloads,
      gameVersions: unique(
        projectVersionsForProject.map((version) => version.gameVersions)
      ),
      id: project.id,
      loaders: unique(
        projectVersionsForProject.map((version) => version.loaders)
      ),
      name: project.name,
      slug: project.slug,
      tags: project.tags,
      type: project.type,
      updatedAt: project.updatedAt.toISOString(),
      version: projectVersionsForProject[0]?.versionNumber ?? "",
    };
  });
};

/**
 * Builds one project document, or null when it is not publicly visible.
 *
 * A thin wrapper over the bulk builder so the two cannot drift apart.
 */
export const buildProjectDocument = async (
  projectId: string
): Promise<ProjectDocument | null> => {
  const [document] = await buildProjectDocuments([projectId]);
  return document ?? null;
};
