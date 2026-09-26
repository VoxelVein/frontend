import { desc, eq } from "drizzle-orm";
import { Meilisearch } from "meilisearch";

import { db } from "@/db";
import { projects, projectVersions, users } from "@/db/schema";
import type { ProjectDocument } from "@/lib/projects";

import env from "../../env.config";

export const PROJECTS_INDEX = "projects";

export const PROJECTS_INDEX_SETTINGS = {
  filterableAttributes: ["type", "category", "gameVersions", "loaders"],
  searchableAttributes: ["name", "description", "author", "tags", "category"],
  sortableAttributes: ["downloads", "updatedAt", "name"],
  typoTolerance: {
    enabled: true,
    minWordSizeForTypos: { oneTypo: 1, twoTypos: 3 },
  },
};

// Writes use a key scoped to document changes on the projects index, never
// the master key. Without it, search simply goes stale until the next
// `pnpm db:seed:projects --reindex`.
const getWriteIndex = () => {
  if (!env.MEILI_ADMIN_KEY) {
    return null;
  }
  return new Meilisearch({
    apiKey: env.MEILI_ADMIN_KEY,
    host: env.MEILI_HOST,
  }).index<ProjectDocument>(PROJECTS_INDEX);
};

const unique = (values: string[][]): string[] => [...new Set(values.flat())];

/** Builds the search document for a published project, or null otherwise. */
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
      slug: projects.slug,
      status: projects.status,
      summary: projects.summary,
      tags: projects.tags,
      type: projects.type,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(users, eq(users.id, projects.ownerId))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || project.status !== "published") {
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
      project.authorName,
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

/**
 * Brings the search index in line with the database for one project.
 * Failures are logged, not thrown: the database is the source of truth and
 * a stale index must not block the write that triggered it.
 */
export const syncProjectToSearch = async (projectId: string): Promise<void> => {
  const index = getWriteIndex();
  if (!index) {
    console.warn("MEILI_ADMIN_KEY is not set; project search was not updated.");
    return;
  }

  try {
    const document = await buildProjectDocument(projectId);
    await (document
      ? index.addDocuments([document])
      : index.deleteDocument(projectId));
  } catch (error) {
    console.error(`Could not update search for project ${projectId}`, error);
  }
};
