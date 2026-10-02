import { createServerFn } from "@tanstack/react-start";
import { and, eq, max, sql } from "drizzle-orm";

import { db } from "@/db";
import { projects, projectVersions } from "@/db/schema";
import { buildProjectDocuments } from "@/lib/project-document";
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
  // One batched read rather than a query per project: `buildProjectDocuments`
  // already does the `inArray` fan-out for projects, versions and images.
  const documents = await buildProjectDocuments(ids);

  // The batch builder returns rows in database order, but the caller labels
  // these #1..#n, so the score order has to be reapplied here. Projects that
  // stopped being public between the two queries are simply absent, which is
  // what the old per-id `null` filter did too.
  const byId = new Map(documents.map((document) => [document.id, document]));
  return ids.flatMap((id) => {
    const document = byId.get(id);
    return document ? [document] : [];
  });
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
