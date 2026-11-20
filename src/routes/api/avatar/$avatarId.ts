import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { pipe, safeParse, string, uuid } from "valibot";

import { db } from "@/db";
import { userImages } from "@/db/schema";
import { getObjectBytes, StorageError } from "@/lib/storage";

/**
 * Serves an avatar's bytes.
 *
 * Unlike `/api/image/$imageId`, this does **not** hide the avatar of an account
 * that is waiting to be deleted. A project must disappear with its owner, but a
 * profile byline already shows the display name of a deleted account as
 * "Deleted user"; dropping its avatar as well would leave the byline's picture
 * suddenly broken. The image is a public avatar either way.
 *
 * Immutable for the life of the row, so the browser may hold it indefinitely.
 * Replacing an avatar creates a new row with a new id, which invalidates the
 * old URL.
 */

const uuidSchema = pipe(string(), uuid());

const CACHE_CONTROL = "public, max-age=31536000, immutable";

const notFound = () =>
  new Response("Not found", {
    headers: { "cache-control": "no-store" },
    status: 404,
  });

const handleAvatar = async (avatarId: string): Promise<Response> => {
  if (!safeParse(uuidSchema, avatarId).success) {
    return notFound();
  }

  const [avatar] = await db
    .select({
      contentType: userImages.contentType,
      storageKey: userImages.storageKey,
    })
    .from(userImages)
    .where(eq(userImages.id, avatarId))
    .limit(1);

  if (!avatar) {
    return notFound();
  }

  let object: Awaited<ReturnType<typeof getObjectBytes>>;
  try {
    object = await getObjectBytes(avatar.storageKey);
  } catch (error) {
    if (error instanceof StorageError) {
      // The row exists but the object does not. 404 rather than 5xx: the
      // client will fall back to a letter tile, which is the right rendering.
      return notFound();
    }
    throw error;
  }

  const headers = new Headers({
    "cache-control": CACHE_CONTROL,
    "content-type": avatar.contentType,
    // Uploaded bytes are user content. The four accepted formats are all
    // inert images, and this keeps a browser from sniffing its way to
    // something executable even if the stored type were ever wrong.
    "content-security-policy": "default-src 'none'; sandbox",
    "x-content-type-options": "nosniff",
  });
  if (object.contentLength !== null) {
    headers.set("content-length", String(object.contentLength));
  }
  if (object.etag) {
    headers.set("etag", object.etag);
  }

  return new Response(object.body, { headers, status: 200 });
};

export const Route = createFileRoute("/api/avatar/$avatarId")({
  server: {
    handlers: {
      // oxlint-disable-next-line sonarjs/function-name -- HTTP method names required by TanStack Start
      GET: async ({ params }: { params: { avatarId: string } }) =>
        await handleAvatar(params.avatarId),
    },
  },
});
