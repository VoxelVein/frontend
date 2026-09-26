import { createFileRoute } from "@tanstack/react-router";
import { eq, sql } from "drizzle-orm";
import { pipe, safeParse, string, uuid } from "valibot";

import { db } from "@/db";
import { projectFiles, projects, projectVersions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getForwardedClientIp } from "@/lib/client-key";
import {
  createDownloadDeduper,
  isPrefetchRequest,
} from "@/lib/download-counter";
import { getDownloadUrl } from "@/lib/storage";

const uuidSchema = pipe(string(), uuid());
const TRUST_PROXY = process.env.TRUST_PROXY === "true";
const downloadDeduper = createDownloadDeduper();

// Signed-in users are keyed by account, everyone else by the proxy-reported
// IP. A failed session lookup must not block the download itself.
const getClientKey = async (request: Request): Promise<string | null> => {
  const session = await auth.api
    .getSession({ headers: request.headers })
    .catch(() => null);
  if (session) {
    return `user:${session.user.id}`;
  }
  const ip = getForwardedClientIp(request.headers, TRUST_PROXY);
  return ip ? `ip:${ip}` : null;
};

const incrementDownloads = async (file: {
  projectId: string;
  versionId: string;
}) => {
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
};

const notFound = () =>
  Response.json({ error: "File not found." }, { status: 404 });

const handleDownload = async (
  request: Request,
  fileId: string
): Promise<Response> => {
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

  if (
    !isPrefetchRequest(request.headers) &&
    downloadDeduper.shouldCount(await getClientKey(request), fileId)
  ) {
    await incrementDownloads(file);
  }

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
      GET: ({
        params,
        request,
      }: {
        params: { fileId: string };
        request: Request;
      }) => handleDownload(request, params.fileId),
    },
  },
});
