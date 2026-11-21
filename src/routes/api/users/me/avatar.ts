import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import sharp from "sharp";

import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth.functions";
import { AVATAR_MAX_BYTES, readImage } from "@/lib/image-validation";
import {
  consumeRateLimit,
  rateLimitedResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import {
  deleteObjects,
  IMMUTABLE_CACHE_CONTROL,
  loadStorageConfig,
  StorageError,
  uploadStream,
} from "@/lib/storage";
import { errorResponse, storageErrorResponse } from "@/lib/storage-http";
import {
  getRemainingBytes,
  insertAvatarWithinQuota,
  quotaExceededError,
  removeAvatar,
} from "@/lib/storage-quota";
import { peekStream } from "@/lib/upload-validation";

import env from "../../../../../env.config";

/**
 * Upload and remove the signed-in account's avatar.
 *
 * Mirrors `api/projects/$projectId/images.ts` step for step, because the
 * hazards are identical: a body that lies about its type, a client-chosen
 * storage key, and a quota that has to be checked inside the write rather than
 * before it.
 *
 * The object is written to `avatars/{userId}-{hash}.webp` - the hash of the
 * bytes sharp produced - and served from `/api/avatar/$avatarId`. `users.image`
 * is written with that URL, which is the field Better Auth already reads for an
 * avatar, so the navbar, the account menu, and the public profile all pick it
 * up with no per-surface change.
 */

// The same reasoning as the project image route: large enough for every
// dimension reader in `readImage`.
const HEADER_BYTES = 64;

// Browsers send Origin on PUT; reject cross-site uploads rather than relying
// only on the session cookie's SameSite setting.
const isSameOrigin = (request: Request): boolean =>
  request.headers.get("origin") === new URL(env.BETTER_AUTH_URL).origin;

const handleUpload = async (request: Request): Promise<Response> => {
  if (!isSameOrigin(request)) {
    return errorResponse(403, "Cross-origin uploads are not allowed.");
  }

  const session = await getSession();

  if (!session) {
    return errorResponse(401, "Sign in to upload an avatar.");
  }

  // Per user: an upload costs a bucket write and a database row.
  const quota = await consumeRateLimit(
    "avatar-upload",
    `user:${session.user.id}`,
    RATE_LIMITS.upload
  );

  if (quota.limited) {
    return rateLimitedResponse(quota.retryAfterSeconds);
  }

  const { quotaBytes } = loadStorageConfig();
  const declaredLength = Number(request.headers.get("content-length") ?? "0");

  if (declaredLength > AVATAR_MAX_BYTES) {
    return errorResponse(
      413,
      `Avatars can be at most ${AVATAR_MAX_BYTES} bytes.`
    );
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

  // The client crops and re-encodes before sending, so what arrives is already
  // a square WebP; sharp re-encodes it rather than trusting the client to have
  // done it, and the bytes it writes are the ones that get hashed and stored.
  const sourceChunks: Uint8Array[] = [];

  for await (const chunk of stream) {
    sourceChunks.push(chunk);
  }

  const source = Buffer.concat(sourceChunks);

  const processed = await sharp(source)
    .rotate()
    .resize(512, 512, { fit: "cover" })
    .webp({ quality: 80, effort: 5 })
    .toBuffer();

  const id = crypto.randomUUID();
  // oxlint-disable-next-line sonarjs/hashing -- Content fingerprint, not a security control.
  const hash = createHash("sha1").update(processed).digest("hex");
  const filename = `${session.user.id}-${hash}.webp`;
  const storageKey = `avatars/${filename}`;

  const stored = await uploadStream({
    body: Readable.from([processed]),
    contentType: "image/webp",
    filename,
    inline: true,
    key: storageKey,
    maxBytes: remainingBytes ?? AVATAR_MAX_BYTES,
    cacheControl: IMMUTABLE_CACHE_CONTROL,
  });

  const url = `/api/avatar/${id}`;
  let superseded: string | null = null;

  try {
    superseded = await insertAvatarWithinQuota(
      {
        contentType: "image/webp",
        height: 512,
        id,
        size: stored.size,
        storageKey,
        userId: session.user.id,
        width: 512,
      },
      quotaBytes
    );
  } catch (error) {
    // No row references the object, so it has no owner. Drop it.
    await deleteObjects([storageKey]).catch(() => null);
    throw error;
  }

  await db
    .update(users)
    .set({ image: url })
    .where(eq(users.id, session.user.id));

  if (superseded && superseded !== storageKey) {
    await deleteObjects([superseded]).catch(() => null);
  }

  return Response.json(
    {
      contentType: "image/webp",
      height: 512,
      size: stored.size,
      url,
      width: 512,
    },
    { status: 201 }
  );
};

const handleDelete = async (): Promise<Response> => {
  const session = await getSession();

  if (!session) {
    return errorResponse(401, "Sign in to remove your avatar.");
  }

  const storageKey = await removeAvatar(session.user.id);
  // Clear the field either way: a row that is already gone must not leave a
  // dangling avatar URL behind on the user.
  await db
    .update(users)
    .set({ image: null })
    .where(eq(users.id, session.user.id));

  if (storageKey) {
    await deleteObjects([storageKey]).catch(() => null);
  }

  return Response.json({ ok: true });
};

const asResponse = async (action: () => Promise<Response>) => {
  try {
    return await action();
  } catch (error) {
    if (error instanceof StorageError) {
      return storageErrorResponse(error, "avatar");
    }

    console.error("Avatar change failed", error);

    return errorResponse(500, "The avatar could not be saved. Try again.");
  }
};

export const Route = createFileRoute("/api/users/me/avatar")({
  server: {
    handlers: {
      // oxlint-disable-next-line sonarjs/function-name -- HTTP method names required by TanStack Start
      DELETE: async () => await asResponse(handleDelete),
      // oxlint-disable-next-line sonarjs/function-name -- HTTP method names required by TanStack Start
      PUT: async ({ request }: { request: Request }) =>
        await asResponse(() => handleUpload(request)),
    },
  },
});
