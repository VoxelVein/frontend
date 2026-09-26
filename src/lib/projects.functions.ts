import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, count, desc, eq, inArray, ne } from "drizzle-orm";
import { boolean, object, parse, pipe, string, uuid } from "valibot";

import { db } from "@/db";
import { projectFiles, projects, projectVersions, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  isAdmin,
  ProjectAccessError,
  PROJECT_ACCESS_ERROR,
  requireEditableProject,
  requireUploader,
} from "@/lib/project-access";
import type { Session } from "@/lib/project-access";
import {
  DELETED_USER_LABEL,
  isCategoryForType,
  LOADERS_BY_TYPE,
  projectInputSchema,
  projectSlugSchema,
  projectUpdateSchema,
  versionInputSchema,
} from "@/lib/projects";
import type {
  ProjectInput,
  ProjectListItem,
  ProjectUpdateInput,
  ProjectView,
  VersionInput,
} from "@/lib/projects";
import { syncProjectToSearch } from "@/lib/search-sync";
import { deleteObjects } from "@/lib/storage";

const PG_UNIQUE_VIOLATION = "23505";

const projectIdSchema = object({ projectId: pipe(string(), uuid()) });
const versionIdSchema = object({ versionId: pipe(string(), uuid()) });
const slugSchema = object({ slug: projectSlugSchema });

// Drizzle wraps driver errors, so the Postgres code may sit on a cause.
const hasErrorCode = (cause: unknown, code: string): boolean => {
  if (!(cause instanceof Error)) {
    return false;
  }
  if ("code" in cause && cause.code === code) {
    return true;
  }
  return hasErrorCode(cause.cause, code);
};

const getSessionOrNull = (): Promise<Session | null> =>
  auth.api.getSession({ headers: getRequestHeaders() });

const getUploader = (): Promise<Session> =>
  requireUploader(getRequestHeaders());

const loadProjectView = async (
  where: ReturnType<typeof eq>
): Promise<ProjectView | null> => {
  const project = await db.query.projects.findFirst({
    where,
    with: {
      owner: {
        columns: { displayUsername: true, name: true, username: true },
      },
      versions: {
        orderBy: [desc(projectVersions.createdAt)],
        with: {
          files: {
            orderBy: [desc(projectFiles.primary), projectFiles.filename],
          },
        },
      },
    },
  });

  if (!project) {
    return null;
  }

  return {
    author: project.owner
      ? (project.owner.displayUsername ??
        project.owner.username ??
        project.owner.name)
      : DELETED_USER_LABEL,
    category: project.category,
    description: project.description,
    downloads: project.downloads,
    id: project.id,
    isProtected: project.isProtected,
    name: project.name,
    ownerId: project.ownerId,
    pendingDeletion: project.pendingDeletion,
    publishedAt: project.publishedAt?.toISOString() ?? null,
    slug: project.slug,
    status: project.status,
    summary: project.summary,
    tags: project.tags,
    type: project.type,
    updatedAt: project.updatedAt.toISOString(),
    versions: project.versions.map((version) => ({
      changelog: version.changelog,
      channel: version.channel,
      createdAt: version.createdAt.toISOString(),
      downloads: version.downloads,
      files: version.files.map((file) => ({
        filename: file.filename,
        id: file.id,
        primary: file.primary,
        sha1: file.sha1,
        sha512: file.sha512,
        size: file.size,
      })),
      gameVersions: version.gameVersions,
      id: version.id,
      loaders: version.loaders,
      name: version.name,
      versionNumber: version.versionNumber,
    })),
  };
};

const canSeeUnpublished = (
  session: Session | null,
  project: ProjectView
): boolean =>
  session !== null &&
  project.status !== "removed" &&
  (session.user.id === project.ownerId || isAdmin(session));

/** Public project page data. Drafts are only visible to owners and admins. */
export const getProject = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => parse(slugSchema, data))
  .handler(async ({ data }): Promise<ProjectView | null> => {
    const project = await loadProjectView(eq(projects.slug, data.slug));
    if (!project) {
      return null;
    }
    if (project.pendingDeletion) {
      // Its owner is deleting their account; only admins may still look.
      const session = await getSessionOrNull();
      return session && isAdmin(session) ? project : null;
    }
    if (project.status === "published") {
      return project;
    }
    return canSeeUnpublished(await getSessionOrNull(), project)
      ? project
      : null;
  });

export const getEditableProject = createServerFn({ method: "GET" })
  .validator((data: { projectId: string }) => parse(projectIdSchema, data))
  .handler(async ({ data }): Promise<ProjectView> => {
    const session = await getUploader();
    await requireEditableProject(session, data.projectId);
    const project = await loadProjectView(eq(projects.id, data.projectId));
    if (!project) {
      throw new ProjectAccessError(PROJECT_ACCESS_ERROR.notFound);
    }
    return project;
  });

export const listMyProjects = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProjectListItem[]> => {
    const session = await getSessionOrNull();
    if (!session) {
      throw new ProjectAccessError(PROJECT_ACCESS_ERROR.unauthenticated);
    }

    const rows = await db
      .select({
        downloads: projects.downloads,
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        status: projects.status,
        type: projects.type,
        updatedAt: projects.updatedAt,
        versionCount: count(projectVersions.id),
      })
      .from(projects)
      .leftJoin(projectVersions, eq(projectVersions.projectId, projects.id))
      .where(
        and(
          eq(projects.ownerId, session.user.id),
          ne(projects.status, "removed")
        )
      )
      .groupBy(projects.id)
      .orderBy(desc(projects.updatedAt));

    return rows.map((row) => ({
      ...row,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
);

export const createProject = createServerFn({ method: "POST" })
  .validator((data: ProjectInput) => parse(projectInputSchema, data))
  .handler(async ({ data }): Promise<{ id: string; slug: string }> => {
    const session = await getUploader();

    try {
      const [created] = await db
        .insert(projects)
        .values({ ...data, ownerId: session.user.id })
        .returning({ id: projects.id, slug: projects.slug });
      // Remembered for good: owning a project once means a later account
      // deletion gets the recoverable grace period.
      await db
        .update(users)
        .set({ hasOwnedProject: true })
        .where(eq(users.id, session.user.id));
      return created;
    } catch (error) {
      if (hasErrorCode(error, PG_UNIQUE_VIOLATION)) {
        throw new Error("That slug is already taken. Choose another one.", {
          cause: error,
        });
      }
      throw error;
    }
  });

export const updateProject = createServerFn({ method: "POST" })
  .validator((data: ProjectUpdateInput) => parse(projectUpdateSchema, data))
  .handler(async ({ data }): Promise<void> => {
    const session = await getUploader();
    const { projectId, ...fields } = data;
    const project = await requireEditableProject(session, projectId);

    if (!isCategoryForType(project.type, fields.category)) {
      throw new Error("Choose a category for this project type.");
    }
    await db.update(projects).set(fields).where(eq(projects.id, projectId));
    await syncProjectToSearch(projectId);
  });

const hasPrimaryFile = async (projectId: string): Promise<boolean> => {
  const [row] = await db
    .select({ files: count(projectFiles.id) })
    .from(projectFiles)
    .innerJoin(projectVersions, eq(projectVersions.id, projectFiles.versionId))
    .where(eq(projectVersions.projectId, projectId));
  return (row?.files ?? 0) > 0;
};

export const setProjectPublished = createServerFn({ method: "POST" })
  .validator((data: { projectId: string; published: boolean }) => ({
    ...parse(projectIdSchema, { projectId: data.projectId }),
    published: data.published === true,
  }))
  .handler(async ({ data }): Promise<void> => {
    const session = await getUploader();
    const project = await requireEditableProject(session, data.projectId);

    if (data.published && !(await hasPrimaryFile(project.id))) {
      throw new Error("Upload at least one file before publishing.");
    }

    await db
      .update(projects)
      .set(
        data.published
          ? {
              publishedAt: project.publishedAt ?? new Date(),
              status: "published",
            }
          : { status: "draft" }
      )
      .where(eq(projects.id, project.id));
    await syncProjectToSearch(project.id);
  });

export const createVersion = createServerFn({ method: "POST" })
  .validator((data: VersionInput) => parse(versionInputSchema, data))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const session = await getUploader();
    const { projectId, ...fields } = data;
    const project = await requireEditableProject(session, projectId);

    const allowedLoaders = new Set<string>(LOADERS_BY_TYPE[project.type]);
    if (!fields.loaders.every((loader) => allowedLoaders.has(loader))) {
      throw new Error(`Choose loaders that fit a ${project.type}.`);
    }

    try {
      const [created] = await db
        .insert(projectVersions)
        .values({
          ...fields,
          loaders: [...new Set(fields.loaders)],
          name: fields.name || fields.versionNumber,
          projectId,
        })
        .returning({ id: projectVersions.id });
      await db
        .update(projects)
        .set({ updatedAt: new Date() })
        .where(eq(projects.id, projectId));
      return created;
    } catch (error) {
      if (hasErrorCode(error, PG_UNIQUE_VIOLATION)) {
        throw new Error(
          "This project already has a version with that number.",
          {
            cause: error,
          }
        );
      }
      throw error;
    }
  });

/** Deletes a version and its stored files. */
export const deleteVersion = createServerFn({ method: "POST" })
  .validator((data: { versionId: string }) => parse(versionIdSchema, data))
  .handler(async ({ data }): Promise<void> => {
    const [session, [version]] = await Promise.all([
      getUploader(),
      db
        .select({ projectId: projectVersions.projectId })
        .from(projectVersions)
        .where(eq(projectVersions.id, data.versionId))
        .limit(1),
    ]);
    if (!version) {
      throw new ProjectAccessError(PROJECT_ACCESS_ERROR.notFound);
    }
    const project = await requireEditableProject(session, version.projectId);

    const files = await db
      .select({ storageKey: projectFiles.storageKey })
      .from(projectFiles)
      .where(eq(projectFiles.versionId, data.versionId));

    await db
      .delete(projectVersions)
      .where(eq(projectVersions.id, data.versionId));
    await deleteObjects(files.map((file) => file.storageKey));

    // A published project must always offer something to download.
    if (project.status === "published" && !(await hasPrimaryFile(project.id))) {
      await db
        .update(projects)
        .set({ status: "draft" })
        .where(eq(projects.id, project.id));
    }
    await syncProjectToSearch(project.id);
  });

/** Permanently deletes a project with all versions and stored files. */
export const deleteProject = createServerFn({ method: "POST" })
  .validator((data: { projectId: string }) => parse(projectIdSchema, data))
  .handler(async ({ data }): Promise<void> => {
    const session = await getUploader();
    const project = await requireEditableProject(session, data.projectId);

    const versionIds = db
      .select({ id: projectVersions.id })
      .from(projectVersions)
      .where(eq(projectVersions.projectId, project.id));
    const files = await db
      .select({ storageKey: projectFiles.storageKey })
      .from(projectFiles)
      .where(inArray(projectFiles.versionId, versionIds));

    await db.delete(projects).where(eq(projects.id, project.id));
    await deleteObjects(files.map((file) => file.storageKey));
    await syncProjectToSearch(project.id);
  });

/**
 * Moderation: hides a project everywhere without deleting its data, so the
 * decision can be reviewed or reverted in the database.
 */
export const removeProject = createServerFn({ method: "POST" })
  .validator((data: { projectId: string }) => parse(projectIdSchema, data))
  .handler(async ({ data }): Promise<void> => {
    const session = await getSessionOrNull();
    if (!session || !isAdmin(session)) {
      throw new ProjectAccessError(PROJECT_ACCESS_ERROR.forbidden);
    }
    await db
      .update(projects)
      .set({ status: "removed" })
      .where(eq(projects.id, data.projectId));
    await syncProjectToSearch(data.projectId);
  });

const protectedSchema = object({
  isProtected: boolean(),
  projectId: pipe(string(), uuid()),
});

/**
 * Moderation: marks a large project that must survive its owner deleting
 * their account. Owners cannot choose to delete a protected project.
 */
export const setProjectProtected = createServerFn({ method: "POST" })
  .validator((data: { isProtected: boolean; projectId: string }) =>
    parse(protectedSchema, data)
  )
  .handler(async ({ data }): Promise<void> => {
    const session = await getSessionOrNull();
    if (!session || !isAdmin(session)) {
      throw new ProjectAccessError(PROJECT_ACCESS_ERROR.forbidden);
    }
    await db
      .update(projects)
      .set({ isProtected: data.isProtected })
      .where(eq(projects.id, data.projectId));
  });
