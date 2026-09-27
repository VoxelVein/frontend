import { createServerFn } from "@tanstack/react-start";
import { and, eq, max, sql } from "drizzle-orm";

import { db } from "@/db";
import { projects, projectVersions } from "@/db/schema";
import { buildProjectDocument } from "@/lib/project-document";
import type { ProjectDocument } from "@/lib/projects";
import { pickTrending } from "@/lib/trending";

/** The list is recomputed at most this often, however many visitors ask. */
export const TRENDING_REFRESH_MS = 60 * 1000;

let cached: { expiresAt: number; projects: ProjectDocument[] } | null = null;

const computeTrending = async (): Promise<ProjectDocument[]> => {
  const candidates = await db
    .select({
      downloads: projects.downloads,
      id: projects.id,
      lastActivityAt:
        sql<Date>`coalesce(${max(projectVersions.createdAt)}, ${projects.publishedAt}, ${projects.updatedAt})`.mapWith(
          (value: string | Date) => new Date(value)
        ),
    })
    .from(projects)
    .leftJoin(projectVersions, eq(projectVersions.projectId, projects.id))
    .where(
      and(eq(projects.status, "published"), eq(projects.pendingDeletion, false))
    )
    .groupBy(projects.id);

  const ids = pickTrending(candidates, new Date());
  const documents = await Promise.all(ids.map(buildProjectDocument));
  return documents.filter((document) => document !== null);
};

/** Five trending projects for the home page, refreshed every minute. */
export const getTrendingProjects = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProjectDocument[]> => {
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.projects;
    }
    const trending = await computeTrending();
    cached = { expiresAt: now + TRENDING_REFRESH_MS, projects: trending };
    return trending;
  }
);
