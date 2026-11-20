import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { safeParse, pipe, string, uuid } from "valibot";

import { db } from "@/db";
import { projectFiles, projects, projectVersions } from "@/db/schema";
import {
  HTTP_STATUS_BY_ACCESS_ERROR,
  ProjectAccessError,
  requireEditableProject,
  requireUploader,
} from "@/lib/project-access";
import type { ProjectFileView } from "@/lib/projects";
import {
  consumeRateLimit,
  rateLimitedResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { isPlatformId, platformExtensions } from "@/lib/release-platforms";
import {
  deleteObjects,
  loadStorageConfig,
  STORAGE_ERROR,
  StorageError,
  uploadStream,
} from "@/lib/storage";
import { errorResponse, storageErrorResponse } from "@/lib/storage-http";
import {
  DuplicateFilenameError,
  getRemainingBytes,
  insertFileWithinQuota,
  quotaExceededError,
} from "@/lib/storage-quota";
import {
  ALLOWED_EXTENSIONS_BY_TYPE,
  contentTypeFor,
  hasZipMagic,
  peekStream,
  sanitizeFilename,
} from "@/lib/upload-validation";

import env from "../../../../../../../env.config";

const ZIP_MAGIC_LENGTH = 4;
const FILE_NOT_FOUND_MESSAGE = "File not found.";
const CROSS_ORIGIN_MESSAGE = "Cross-origin requests are not allowed.";
const uuidSchema = pipe(string(), uuid());

// 507 Insufficient Storage: the site-wide quota is full, not this file.
/**
 * Streams the upload. When the stream stops because it ran into the space
 * left in the quota (rather than the per-file limit), report the quota.
 */
const uploadWithinQuota = async (
  input: Parameters<typeof uploadStream>[0] & { maxBytes?: number }
) => {
  try {
    return await uploadStream(input);
  } catch (error) {
    const hitQuota =
      error instanceof StorageError &&
      error.code === STORAGE_ERROR.fileTooLarge &&
      input.maxBytes !== undefined &&
      input.maxBytes < loadStorageConfig().maxFileBytes;
    throw hitQuota ? quotaExceededError() : error;
  }
};

// Browsers always send Origin on PUT; reject cross-site uploads outright
// instead of relying only on the session cookie's SameSite setting.
const isSameOrigin = (request: Request): boolean =>
  request.headers.get("origin") === new URL(env.BETTER_AUTH_URL).origin;

// oxlint-disable eslint/complexity, sonarjs/cognitive-complexity -- Keep origin, auth, ownership, rate, archive, quota, and storage checks ordered before committing an uploaded file.
const handleUpload = async (
  request: Request,
  params: { projectId: string; versionId: string }
): Promise<Response> => {
  if (!isSameOrigin(request)) {
    return errorResponse(403, "Cross-origin uploads are not allowed.");
  }
  if (
    !safeParse(uuidSchema, params.projectId).success ||
    !safeParse(uuidSchema, params.versionId).success
  ) {
    return errorResponse(404, "Version not found.");
  }

  const session = await requireUploader(request.headers);
  const project = await requireEditableProject(session, params.projectId);

  // Per user rather than per address: a version upload writes several objects
  // and a row, so bounding it per account is what keeps one client from
  // filling the bucket.
  const quota = await consumeRateLimit(
    "file-upload",
    `user:${session.user.id}`,
    RATE_LIMITS.upload
  );
  if (quota.limited) {
    return rateLimitedResponse(quota.retryAfterSeconds);
  }

  const [version] = await db
    .select({ id: projectVersions.id })
    .from(projectVersions)
    .where(
      and(
        eq(projectVersions.id, params.versionId),
        eq(projectVersions.projectId, project.id)
      )
    )
    .limit(1);
  if (!version) {
    return errorResponse(404, "Version not found.");
  }

  const extensions = ALLOWED_EXTENSIONS_BY_TYPE[project.type];
  if (extensions.length === 0) {
    return errorResponse(415, "This project type does not take files.");
  }
  const search = new URL(request.url).searchParams;
  const platformValue = search.get("platform");
  if (
    project.type === "modpack" &&
    (!platformValue || !isPlatformId(platformValue))
  ) {
    return errorResponse(400, "Choose a valid platform for this modpack file.");
  }
  if (project.type !== "modpack" && platformValue !== null) {
    return errorResponse(
      400,
      "Platform targets are only available for modpacks."
    );
  }
  const platform = project.type === "modpack" ? platformValue : null;
  const filename = sanitizeFilename(search.get("filename"), project.type);
  if (!filename) {
    return errorResponse(
      415,
      `Upload a ${extensions.join(" or ")} file whose name uses only letters, numbers, dots, dashes, underscores, and plus signs.`
    );
  }
  if (
    platform &&
    !platformExtensions(platform).some((extension) =>
      filename.toLowerCase().endsWith(extension)
    )
  ) {
    return errorResponse(
      415,
      `Files for this platform must use ${platformExtensions(platform).join(" or ")}.`
    );
  }

  const { maxFileBytes, quotaBytes } = loadStorageConfig();
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > maxFileBytes) {
    return errorResponse(413, `Files can be at most ${maxFileBytes} bytes.`);
  }
  const [existingPlatformFile] = platform
    ? await db
        .select({ id: projectFiles.id, size: projectFiles.size })
        .from(projectFiles)
        .where(
          and(
            eq(projectFiles.versionId, version.id),
            eq(projectFiles.platform, platform)
          )
        )
        .limit(1)
    : [];
  const remainingBytes = await getRemainingBytes(quotaBytes);
  const uploadAllowance =
    remainingBytes === null
      ? null
      : remainingBytes + (existingPlatformFile?.size ?? 0);
  if (
    uploadAllowance !== null &&
    (uploadAllowance === 0 || declaredLength > uploadAllowance)
  ) {
    throw quotaExceededError();
  }
  if (!request.body) {
    return errorResponse(400, "The upload is empty.");
  }

  // Fail fast before streaming; insertFileWithinQuota re-checks under a lock.
  const [duplicate] = await db
    .select({ id: projectFiles.id, platform: projectFiles.platform })
    .from(projectFiles)
    .where(
      and(
        eq(projectFiles.versionId, version.id),
        eq(projectFiles.filename, filename)
      )
    )
    .limit(1);
  if (duplicate && (platform === null || duplicate.platform === null)) {
    throw new DuplicateFilenameError();
  }

  const { head, stream } = await peekStream(request.body, ZIP_MAGIC_LENGTH);
  if (!hasZipMagic(head)) {
    return errorResponse(415, "The file is not a valid archive.");
  }

  const fileId = crypto.randomUUID();
  const storageKey = `projects/${project.id}/${version.id}/${fileId}/${filename}`;
  const stored = await uploadWithinQuota({
    body: stream,
    contentType: contentTypeFor(filename),
    filename,
    key: storageKey,
    maxBytes: uploadAllowance ?? undefined,
  });

  let primary: boolean;
  let replacedStorageKey: string | null;
  try {
    ({ primary, replacedStorageKey } = await insertFileWithinQuota(
      {
        filename,
        id: fileId,
        platform,
        sha1: stored.sha1,
        sha512: stored.sha512,
        size: stored.size,
        storageKey,
        versionId: version.id,
      },
      quotaBytes
    ));
  } catch (error) {
    // Another upload used the remaining space or took the filename first;
    // drop this object.
    await deleteObjects([storageKey]).catch(() => null);
    throw error;
  }
  if (replacedStorageKey) {
    await deleteObjects([replacedStorageKey]).catch(() => null);
  }
  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, project.id));

  const file: ProjectFileView = {
    filename,
    id: fileId,
    platform,
    primary,
    sha1: stored.sha1,
    sha512: stored.sha512,
    size: stored.size,
  };
  return Response.json(file, { status: 201 });
};

// oxlint-enable eslint/complexity, sonarjs/cognitive-complexity

const handleDelete = async (
  request: Request,
  params: { projectId: string; versionId: string }
): Promise<Response> => {
  if (!isSameOrigin(request)) {
    return errorResponse(403, CROSS_ORIGIN_MESSAGE);
  }
  if (
    !safeParse(uuidSchema, params.projectId).success ||
    !safeParse(uuidSchema, params.versionId).success
  ) {
    return errorResponse(404, FILE_NOT_FOUND_MESSAGE);
  }
  const fileId = new URL(request.url).searchParams.get("fileId");
  if (!fileId || !safeParse(uuidSchema, fileId).success) {
    return errorResponse(404, FILE_NOT_FOUND_MESSAGE);
  }
  const session = await requireUploader(request.headers);
  const project = await requireEditableProject(session, params.projectId);
  const [file] = await db
    .select({
      id: projectFiles.id,
      primary: projectFiles.primary,
      storageKey: projectFiles.storageKey,
    })
    .from(projectFiles)
    .innerJoin(projectVersions, eq(projectVersions.id, projectFiles.versionId))
    .where(
      and(
        eq(projectFiles.id, fileId),
        eq(projectVersions.id, params.versionId),
        eq(projectVersions.projectId, project.id)
      )
    )
    .limit(1);
  if (!file) {
    return errorResponse(404, FILE_NOT_FOUND_MESSAGE);
  }
  await db.delete(projectFiles).where(eq(projectFiles.id, file.id));
  if (file.primary) {
    const [replacement] = await db
      .select({ id: projectFiles.id })
      .from(projectFiles)
      .where(eq(projectFiles.versionId, params.versionId))
      .limit(1);
    if (replacement) {
      await db
        .update(projectFiles)
        .set({ primary: true })
        .where(eq(projectFiles.id, replacement.id));
    }
  }
  await deleteObjects([file.storageKey]).catch(() => null);
  const [remaining] = await db
    .select({ id: projectFiles.id })
    .from(projectFiles)
    .innerJoin(projectVersions, eq(projectVersions.id, projectFiles.versionId))
    .where(eq(projectVersions.projectId, project.id))
    .limit(1);
  const projectUpdate =
    project.status === "published" && !remaining
      ? { updatedAt: new Date(), status: "draft" as const }
      : { updatedAt: new Date() };
  await db
    .update(projects)
    .set(projectUpdate)
    .where(eq(projects.id, project.id));
  return new Response(null, { status: 204 });
};

export const Route = createFileRoute(
  "/api/projects/$projectId/versions/$versionId/files"
)({
  server: {
    handlers: {
      // oxlint-disable-next-line sonarjs/function-name -- HTTP method names required by TanStack Start
      PUT: async ({
        params,
        request,
      }: {
        params: { projectId: string; versionId: string };
        request: Request;
      }) => {
        try {
          return await handleUpload(request, params);
        } catch (error) {
          if (error instanceof ProjectAccessError) {
            return errorResponse(
              HTTP_STATUS_BY_ACCESS_ERROR[error.code],
              error.message
            );
          }
          if (error instanceof StorageError) {
            return storageErrorResponse(error, "file");
          }
          if (error instanceof DuplicateFilenameError) {
            return errorResponse(409, error.message);
          }
          console.error("Upload failed", error);
          return errorResponse(500, "The upload failed. Try again.");
        }
      },
      // oxlint-disable-next-line sonarjs/function-name -- HTTP method handler names are required by TanStack Start.
      DELETE: async ({
        params,
        request,
      }: {
        params: { projectId: string; versionId: string };
        request: Request;
      }) => {
        try {
          return await handleDelete(request, params);
        } catch (error) {
          if (error instanceof ProjectAccessError) {
            return errorResponse(
              HTTP_STATUS_BY_ACCESS_ERROR[error.code],
              error.message
            );
          }
          console.error("File delete failed", error);
          return errorResponse(500, "The file could not be deleted.");
        }
      },
    },
  },
});
