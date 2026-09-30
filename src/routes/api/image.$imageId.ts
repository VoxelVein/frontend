import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { pipe, safeParse, string, uuid } from "valibot";

import { db } from "@/db";
import { projectImages, projects } from "@/db/schema";
import { getObjectBytes, StorageError } from "@/lib/storage";

const uuidSchema = pipe(string(), uuid());

// Icons and gallery images are immutable for the life of a row, so the
// browser may hold them indefinitely. Replacing an image creates a new row
// with a new id, which invalidates the old URL.
const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";

const notFound = () =>
  new Response("Not found", {
    headers: { "cache-control": "no-store" },
    status: 404,
  });

/**
 * Streams an image's bytes.
 *
 * A project's images are public only once it is published, matching the rule
 * the file download route applies. Without this check a draft project's icon
 * would be readable by anyone who could guess its id.
 *
 * The response is proxied rather than redirected, because a redirect would
 * need a presigned URL (which expires in five minutes, so a cached page would
 * show broken images) and because the guard has to run on every request anyway.
 */
const handleImage = async (imageId: string): Promise<Response> => {
  if (!safeParse(uuidSchema, imageId).success) {
    return notFound();
  }

  const [image] = await db
    .select({
      contentType: projectImages.contentType,
      height: projectImages.height,
      pendingDeletion: projects.pendingDeletion,
      status: projects.status,
      storageKey: projectImages.storageKey,
      width: projectImages.width,
    })
    .from(projectImages)
    .innerJoin(projects, eq(projects.id, projectImages.projectId))
    .where(eq(projectImages.id, imageId))
    .limit(1);

  if (!image || image.status !== "published" || image.pendingDeletion) {
    return notFound();
  }

  let object: Awaited<ReturnType<typeof getObjectBytes>>;
  try {
    object = await getObjectBytes(image.storageKey);
  } catch (error) {
    if (error instanceof StorageError) {
      return notFound();
    }
    throw error;
  }

  const headers = new Headers({
    "cache-control": IMAGE_CACHE_CONTROL,
    "content-type": image.contentType,
    // Stop a stored image being interpreted as script or HTML.
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

export const Route = createFileRoute("/api/image/$imageId")({
  server: {
    handlers: {
      // oxlint-disable-next-line sonarjs/function-name -- HTTP method names required by TanStack Start
      GET: async ({ params }: { params: { imageId: string } }) => {
        try {
          return await handleImage(params.imageId);
        } catch (error) {
          console.error("Image request failed", error);
          return new Response("Image unavailable", { status: 503 });
        }
      },
    },
  },
});
