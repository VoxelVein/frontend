import { createFileRoute } from "@tanstack/react-router";
import { eq, sql } from "drizzle-orm";
import { pipe, safeParse, string, uuid } from "valibot";

import { db } from "@/db";
import { projectFiles, projects, projectVersions } from "@/db/schema";
import { getDownloadUrl } from "@/lib/storage";

const uuidSchema = pipe(string(), uuid());

const notFound = () =>
  Response.json({ error: "File not found." }, { status: 404 });

const handleDownload = async (fileId: string): Promise<Response> => {
  if (!safeParse(uuidSchema, fileId).success) {
    return notFound();
  }

  const [file] = await db
    .select({
      projectId: projects.id,
      status: projects.status,
      storageKey: projectFiles.storageKey,
      versionId: projectVersions.id,
    })
    .from(projectFiles)
    .innerJoin(projectVersions, eq(projectVersions.id, projectFiles.versionId))
    .innerJoin(projects, eq(projects.id, projectVersions.projectId))
    .where(eq(projectFiles.id, fileId))
    .limit(1);

  if (!file || file.status !== "published") {
    return notFound();
  }

  await db.transaction(async (tx) => {
    await tx
      .update(projectVersions)
      .set({ downloads: sql`${projectVersions.downloads} + 1` })
      .where(eq(projectVersions.id, file.versionId));
    await tx
      .update(projects)
      // Keep updatedAt as is: a download is not a project update.
      .set({
        downloads: sql`${projects.downloads} + 1`,
        updatedAt: sql`${projects.updatedAt}`,
      })
      .where(eq(projects.id, file.projectId));
  });

  return new Response(null, {
    headers: {
      "cache-control": "no-store",
      location: await getDownloadUrl(file.storageKey),
    },
    status: 302,
  });
};

export const Route = createFileRoute("/api/download/$fileId")({
  server: {
    handlers: {
      // oxlint-disable-next-line sonarjs/function-name -- HTTP method names required by TanStack Start
      GET: ({ params }: { params: { fileId: string } }) =>
        handleDownload(params.fileId),
    },
  },
});
