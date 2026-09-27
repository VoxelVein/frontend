import { desc, eq } from "drizzle-orm";
import { Meilisearch } from "meilisearch";

import { db } from "@/db";
import { projects, projectVersions, users } from "@/db/schema";
import { DELETED_USER_LABEL } from "@/lib/projects";
import type { ProjectDocument } from "@/lib/projects";
import { findServersLinking, loadServerDetails } from "@/lib/server-details";

import env from "../../env.config";

export const PROJECTS_INDEX = "projects";

export const PROJECTS_INDEX_SETTINGS = {
  filterableAttributes: [
    "type",
    "category",
    "gameVersions",
    "loaders",
    "clientRequirement",
  ],
  searchableAttributes: ["name", "description", "author", "tags", "category"],
  sortableAttributes: ["downloads", "updatedAt", "name"],
  typoTolerance: {
    enabled: true,
    minWordSizeForTypos: { oneTypo: 1, twoTypos: 3 },
  },
};

// Writes use a key scoped to document changes, `indexes.create` and
// `settings.update` on the projects index, never the master key. Without it,
// search simply goes stale until the next `pnpm db:seed:projects --reindex`.
const getWriteClient = (): Meilisearch | null => {
  if (!env.MEILI_ADMIN_KEY) {
    return null;
  }
  return new Meilisearch({
    apiKey: env.MEILI_ADMIN_KEY,
    host: env.MEILI_HOST,
  });
};

let initialized: Promise<boolean> | null = null;
let warnedSettings = false;

/** Creates the index and applies settings once per process; retries on failure. */
const ensureIndex = async (meili: Meilisearch): Promise<boolean> => {
  initialized ??= (async () => {
    try {
      await meili.createIndex(PROJECTS_INDEX, { primaryKey: "id" });
    } catch {
      // Already exists, which is the normal case after the first run.
    }

    try {
      await meili.index(PROJECTS_INDEX).updateSettings(PROJECTS_INDEX_SETTINGS);
    } catch {
      return false;
    }

    return true;
  })();

  const ready = await initialized;
  if (!ready) {
    initialized = null;
  }
  return ready;
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

  // Servers have no versions; their supported versions live on the listing.
  const server =
    project.type === "server" ? await loadServerDetails(projectId) : null;

  const document: ProjectDocument = {
    author:
      project.authorDisplayUsername ??
      project.authorUsername ??
      project.authorName ??
      DELETED_USER_LABEL,
    category: project.category,
    description: project.summary,
    downloads: project.downloads,
    gameVersions: unique([
      server?.gameVersions ?? [],
      ...versions.map((version) => version.gameVersions),
    ]),
    id: project.id,
    loaders: unique(versions.map((version) => version.loaders)),
    name: project.name,
    slug: project.slug,
    tags: project.tags,
    type: project.type,
    updatedAt: project.updatedAt.toISOString(),
    version: versions[0]?.versionNumber ?? "",
  };
  if (server) {
    document.clientRequirement = server.clientRequirement;
  }
  return document;
};

/**
 * Brings the search index in line with the database for one project.
 * Failures are logged, not thrown: the database is the source of truth and
 * a stale index must not block the write that triggered it.
 */
export const syncProjectToSearch = async (projectId: string): Promise<void> => {
  const meili = getWriteClient();
  if (!meili) {
    console.warn("MEILI_ADMIN_KEY is not set; project search was not updated.");
    return;
  }

  const ready = await ensureIndex(meili);
  if (!ready && !warnedSettings) {
    warnedSettings = true;
    console.warn(
      `Could not apply settings to the "${PROJECTS_INDEX}" index; filtered search may fail. MEILI_ADMIN_KEY needs indexes.create and settings.update on "${PROJECTS_INDEX}".`
    );
  }

  const index = meili.index<ProjectDocument>(PROJECTS_INDEX);
  try {
    const document = await buildProjectDocument(projectId);
    await (document
      ? index.addDocuments([document])
      : index.deleteDocument(projectId));

    // A server's client requirement counts only published links, so servers
    // linking here change when this project is published or hidden.
    const servers = await findServersLinking([projectId]);
    const serverDocuments = await Promise.all(
      servers.map((serverId) => buildProjectDocument(serverId))
    );
    const refreshed = serverDocuments.filter(
      (serverDocument): serverDocument is ProjectDocument =>
        serverDocument !== null
    );
    if (refreshed.length > 0) {
      await index.addDocuments(refreshed);
    }
  } catch (error) {
    console.error(`Could not update search for project ${projectId}`, error);
  }
};
