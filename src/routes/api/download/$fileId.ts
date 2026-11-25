import { createFileRoute } from "@tanstack/react-router";
import { eq, sql } from "drizzle-orm";
import { pipe, safeParse, string, uuid } from "valibot";

import { db } from "@/db";
import {
  projectDownloads,
  projectFiles,
  projects,
  projectVersions,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getForwardedClientIp } from "@/lib/client-key";
import {
  createDownloadDeduper,
  isPrefetchRequest,
} from "@/lib/download-counter";
import { hasSessionRole } from "@/lib/project-access";
import {
  consumeRateLimit,
  rateLimitedResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { getDownloadUrl } from "@/lib/storage";

const uuidSchema = pipe(string(), uuid());
const TRUST_PROXY = process.env.TRUST_PROXY === "true";
const downloadDeduper = createDownloadDeduper();

interface DownloadClient {
  /** The dedupe and rate-limit key: an account when signed in, else an address. */
  key: string | null;
  /** Only signed-in accounts can review, so only they get a download record. */
  userId: string | null;
}

// Signed-in users are keyed by account, everyone else by the proxy-reported
// IP. A failed session lookup must not block the download itself.
const getDownloadClient = async (request: Request): Promise<DownloadClient> => {
  const session = await auth.api
    .getSession({ headers: request.headers })
    .catch(() => null);

  if (session) {
    return { key: `user:${session.user.id}`, userId: session.user.id };
  }

  const ip = getForwardedClientIp(request.headers, TRUST_PROXY);

  return { key: ip ? `ip:${ip}` : null, userId: null };
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

/** Stores the last fetch time for the review gate, once per account and project. */
const recordProjectDownload = async (
  userId: string,
  projectId: string
): Promise<void> => {
  const now = new Date();

  await db
    .insert(projectDownloads)
    .values({ downloadedAt: now, projectId, userId })
    .onConflictDoUpdate({
      target: [projectDownloads.userId, projectDownloads.projectId],
      set: { downloadedAt: now },
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

  // Before the database, so a throttled client costs nothing but the counter.
  // The same identity drives the dedupe and the account's review eligibility.
  const client = await getDownloadClient(request);

  const quota = await consumeRateLimit(
    "download",
    client.key ?? "unknown",
    RATE_LIMITS.download
  );

  if (quota.limited) {
    return rateLimitedResponse(quota.retryAfterSeconds);
  }

  const [file] = await db
    .select({
      pendingDeletion: projects.pendingDeletion,
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

  if (!file || file.pendingDeletion) {
    return notFound();
  }

  if (file.status !== "published") {
    const session = await auth.api
      .getSession({ headers: request.headers })
      .catch(() => null);

    if (
      file.status !== "pending" ||
      !session ||
      !hasSessionRole(session, "moderator")
    ) {
      return notFound();
    }
  }

  if (
    file.status === "published" &&
    !isPrefetchRequest(request.headers) &&
    downloadDeduper.shouldCount(client.key, fileId)
  ) {
    await incrementDownloads(file);

    if (client.userId) {
      await recordProjectDownload(client.userId, file.projectId);
    }
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
