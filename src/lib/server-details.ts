import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { projects, projectServerLinks, projectServers } from "@/db/schema";
import { clientRequirementFor, isServerLinkType } from "@/lib/projects";
import type { ProjectServerView, ServerLinkView } from "@/lib/projects";

const isVisible = (link: { pendingDeletion: boolean; status: string }) =>
  link.status === "published" && !link.pendingDeletion;

/**
 * Join details for a server project, or null before they are saved.
 *
 * Players only see linked projects that are published; `includeHidden` keeps
 * the rest for the owner's form so saving does not silently drop them. The
 * client requirement always counts only what players can see.
 */
export const loadServerDetails = async (
  projectId: string,
  { includeHidden = false }: { includeHidden?: boolean } = {}
): Promise<ProjectServerView | null> => {
  const [server] = await db
    .select()
    .from(projectServers)
    .where(eq(projectServers.projectId, projectId))
    .limit(1);
  if (!server) {
    return null;
  }

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      pendingDeletion: projects.pendingDeletion,
      required: projectServerLinks.required,
      slug: projects.slug,
      status: projects.status,
      type: projects.type,
    })
    .from(projectServerLinks)
    .innerJoin(projects, eq(projects.id, projectServerLinks.linkedProjectId))
    .where(eq(projectServerLinks.serverId, projectId))
    .orderBy(
      desc(projectServerLinks.required),
      asc(projectServerLinks.createdAt)
    );

  const links: ServerLinkView[] = [];
  for (const row of rows) {
    const visible = isVisible(row);
    if (isServerLinkType(row.type) && (visible || includeHidden)) {
      links.push({
        id: row.id,
        name: row.name,
        published: visible,
        required: row.required,
        slug: row.slug,
        type: row.type,
      });
    }
  }

  return {
    address: server.address,
    clientRequirement: clientRequirementFor(
      links.filter((link) => link.published)
    ),
    gameVersions: server.gameVersions,
    links,
    port: server.port,
  };
};

/** Published servers that link to any of these projects. */
export const findServersLinking = async (
  projectIds: string[]
): Promise<string[]> => {
  if (projectIds.length === 0) {
    return [];
  }
  const rows = await db
    .selectDistinct({ serverId: projectServerLinks.serverId })
    .from(projectServerLinks)
    .innerJoin(projects, eq(projects.id, projectServerLinks.serverId))
    .where(
      and(
        inArray(projectServerLinks.linkedProjectId, projectIds),
        eq(projects.status, "published")
      )
    );
  return rows.map((row) => row.serverId);
};
