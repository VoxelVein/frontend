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
import { syncProjectToSearch } from "@/lib/search-sync";
import {
  deleteObjects,
  loadStorageConfig,
  STORAGE_ERROR,
  StorageError,
  uploadStream,
} from "@/lib/storage";
import {
  getRemainingBytes,
  insertFileWithinQuota,
  quotaExceededError,
} from "@/lib/storage-quota";
import {
  hasZipMagic,
  JAR_CONTENT_TYPE,
  peekStream,
  sanitizeFilename,
} from "@/lib/upload-validation";

import env from "../../../env.config";

const ZIP_MAGIC_LENGTH = 4;
const uuidSchema = pipe(string(), uuid());

const errorResponse = (status: number, message: string) =>
  Response.json({ error: message }, { status });

// 507 Insufficient Storage: the site-wide quota is full, not this file.
const HTTP_INSUFFICIENT_STORAGE = 507;

const storageErrorResponse = (error: StorageError): Response => {
  if (error.code === STORAGE_ERROR.fileTooLarge) {
    return errorResponse(413, error.message);
  }
  if (error.code === STORAGE_ERROR.quotaExceeded) {
    return errorResponse(HTTP_INSUFFICIENT_STORAGE, error.message);
  }
  return errorResponse(503, "File storage is unavailable.");
};

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

  const filename = sanitizeFilename(
    new URL(request.url).searchParams.get("filename")
  );
  if (!filename) {
    return errorResponse(
      415,
      "Upload a .jar file whose name uses only letters, numbers, dots, dashes, underscores, and plus signs."
    );
  }

  const { maxFileBytes, quotaBytes } = loadStorageConfig();
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > maxFileBytes) {
    return errorResponse(413, `Files can be at most ${maxFileBytes} bytes.`);
  }
  const remainingBytes = await getRemainingBytes(quotaBytes);
  if (
    remainingBytes !== null &&
    (remainingBytes === 0 || declaredLength > remainingBytes)
  ) {
    throw quotaExceededError();
  }
  if (!request.body) {
    return errorResponse(400, "The upload is empty.");
  }

  const existingFiles = await db
    .select({ filename: projectFiles.filename })
    .from(projectFiles)
    .where(eq(projectFiles.versionId, version.id));
  if (existingFiles.some((file) => file.filename === filename)) {
    return errorResponse(
      409,
      "This version already has a file with that name."
    );
  }

  const { head, stream } = await peekStream(request.body, ZIP_MAGIC_LENGTH);
  if (!hasZipMagic(head)) {
    return errorResponse(415, "The file is not a valid .jar archive.");
  }

  const fileId = crypto.randomUUID();
  const storageKey = `projects/${project.id}/${version.id}/${fileId}/${filename}`;
  const stored = await uploadWithinQuota({
    body: stream,
    contentType: JAR_CONTENT_TYPE,
    filename,
    key: storageKey,
    maxBytes: remainingBytes ?? undefined,
  });

  const primary = existingFiles.length === 0;
  try {
    await insertFileWithinQuota(
      {
        filename,
        id: fileId,
        primary,
        sha1: stored.sha1,
        sha512: stored.sha512,
        size: stored.size,
        storageKey,
        versionId: version.id,
      },
      quotaBytes
    );
  } catch (error) {
    // Another upload used the remaining space first; drop this object.
    await deleteObjects([storageKey]).catch(() => null);
    throw error;
  }
  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, project.id));
  await syncProjectToSearch(project.id);

  const file: ProjectFileView = {
    filename,
    id: fileId,
    primary,
    sha1: stored.sha1,
    sha512: stored.sha512,
    size: stored.size,
  };
  return Response.json(file, { status: 201 });
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
            return storageErrorResponse(error);
          }
          console.error("Upload failed", error);
          return errorResponse(500, "The upload failed. Try again.");
        }
      },
    },
  },
});
