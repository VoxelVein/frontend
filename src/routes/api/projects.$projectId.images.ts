import { createFileRoute } from "@tanstack/react-router";
import { and, count, eq } from "drizzle-orm";
import { safeParse, string, uuid, pipe } from "valibot";

import { db } from "@/db";
import { PROJECT_IMAGE_KIND, projectImages } from "@/db/schema";
import type { ProjectImageKind } from "@/db/schema";
import {
  GALLERY_MAX_COUNT,
  IMAGE_MAX_BYTES,
  imageFilename,
  readImage,
} from "@/lib/image-validation";
import {
  HTTP_STATUS_BY_ACCESS_ERROR,
  ProjectAccessError,
  requireEditableProject,
  requireUploader,
} from "@/lib/project-access";
import {
  deleteObjects,
  loadStorageConfig,
  STORAGE_ERROR,
  StorageError,
  uploadStream,
} from "@/lib/storage";
import {
  getRemainingBytes,
  getProjectImageKeys,
  insertImageWithinQuota,
  quotaExceededError,
} from "@/lib/storage-quota";
import { peekStream } from "@/lib/upload-validation";

import env from "../../../env.config";

const uuidSchema = pipe(string(), uuid());

// The header block must be large enough for the dimension readers: a PNG
// needs 24 bytes, WebP up to 30, and JPEG's start-of-frame marker can sit
// later in the file.
const HEADER_BYTES = 64;

// 507 Insufficient Storage: the site-wide quota is full, not this image.
const HTTP_INSUFFICIENT_STORAGE = 507;

const errorResponse = (status: number, message: string) =>
  Response.json({ error: message }, { status });

const notFound = () => errorResponse(404, "Image not found.");

const storageErrorResponse = (error: StorageError): Response => {
  if (error.code === STORAGE_ERROR.fileTooLarge) {
    return errorResponse(413, error.message);
  }
  if (error.code === STORAGE_ERROR.quotaExceeded) {
    return errorResponse(HTTP_INSUFFICIENT_STORAGE, error.message);
  }
  return errorResponse(503, "Image storage is unavailable.");
};

// Browsers always send Origin on PUT; reject cross-site uploads outright
// instead of relying only on the session cookie's SameSite setting.
const isSameOrigin = (request: Request): boolean =>
  request.headers.get("origin") === new URL(env.BETTER_AUTH_URL).origin;

const parseKind = (value: string | null): ProjectImageKind | null =>
  value === PROJECT_IMAGE_KIND.icon || value === PROJECT_IMAGE_KIND.gallery
    ? value
    : null;

const countGallery = async (projectId: string) => {
  const [row] = await db
    .select({ total: count() })
    .from(projectImages)
    .where(
      and(
        eq(projectImages.projectId, projectId),
        eq(projectImages.kind, PROJECT_IMAGE_KIND.gallery)
      )
    );
  return row?.total ?? 0;
};

const handleUpload = async (
  request: Request,
  projectId: string
): Promise<Response> => {
  if (!isSameOrigin(request)) {
    return errorResponse(403, "Cross-origin uploads are not allowed.");
  }
  if (!safeParse(uuidSchema, projectId).success) {
    return notFound();
  }
  const kind = parseKind(new URL(request.url).searchParams.get("kind"));
  if (!kind) {
    return errorResponse(400, "Specify kind=icon or kind=gallery.");
  }

  const session = await requireUploader(request.headers);
  const project = await requireEditableProject(session, projectId);

  const { quotaBytes } = loadStorageConfig();
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > IMAGE_MAX_BYTES) {
    return errorResponse(
      413,
      `Images can be at most ${IMAGE_MAX_BYTES} bytes.`
    );
  }
  if (kind === PROJECT_IMAGE_KIND.gallery) {
    const total = await countGallery(project.id);
    if (total >= GALLERY_MAX_COUNT) {
      return errorResponse(
        400,
        `A project can have at most ${GALLERY_MAX_COUNT} gallery images.`
      );
    }
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

  const { head, stream } = await peekStream(request.body, HEADER_BYTES);
  // The type comes from the bytes, never from the request's content-type.
  const image = readImage(head);
  if (!image) {
    return errorResponse(415, "Upload a PNG, JPEG, WebP, or GIF image.");
  }

  const id = crypto.randomUUID();
  const filename = imageFilename(id, image.extension, kind);
  const storageKey = `projects/${project.id}/images/${filename}`;

  const stored = await uploadStream({
    body: stream,
    contentType: image.contentType,
    filename,
    inline: true,
    key: storageKey,
    maxBytes: remainingBytes ?? IMAGE_MAX_BYTES,
  });

  // The superseded icon's key, captured before the row is replaced.
  const superseded =
    kind === PROJECT_IMAGE_KIND.icon
      ? await getProjectImageKeys([project.id])
      : [];

  try {
    await insertImageWithinQuota(
      {
        contentType: image.contentType,
        height: image.dimensions.height,
        id,
        kind,
        projectId: project.id,
        size: stored.size,
        storageKey,
        width: image.dimensions.width,
      },
      quotaBytes
    );
  } catch (error) {
    // The row was not recorded, so the object has no owner. Drop it.
    await deleteObjects([storageKey]).catch(() => null);
    throw error;
  }

  if (superseded.length > 0) {
    await deleteObjects(superseded.map((row) => row.storageKey)).catch(
      () => null
    );
  }

  return Response.json(
    {
      contentType: image.contentType,
      height: image.dimensions.height,
      id,
      kind,
      size: stored.size,
      url: `/api/image/${id}`,
      width: image.dimensions.width,
    },
    { status: 201 }
  );
};

const handle = async (request: Request, projectId: string) => {
  try {
    return await handleUpload(request, projectId);
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
    console.error("Image upload failed", error);
    return errorResponse(500, "The image upload failed. Try again.");
  }
};

export const Route = createFileRoute("/api/projects/$projectId/images")({
  server: {
    handlers: {
      // oxlint-disable-next-line sonarjs/function-name -- HTTP method names required by TanStack Start
      PUT: async ({
        params,
        request,
      }: {
        params: { projectId: string };
        request: Request;
      }) => await handle(request, params.projectId),
    },
  },
});

export { errorResponse, isSameOrigin, notFound };
