import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { safeParse, string, uuid, pipe } from "valibot";

import { db } from "@/db";
import { projectImages } from "@/db/schema";
import {
  HTTP_STATUS_BY_ACCESS_ERROR,
  ProjectAccessError,
  requireEditableProject,
  requireUploader,
} from "@/lib/project-access";
import { deleteObjects } from "@/lib/storage";
import { errorResponse } from "@/lib/storage-http";

import { isSameOrigin, notFound } from "./projects.$projectId.images";

const uuidSchema = pipe(string(), uuid());

/**
 * Deletes one of a project's images and its stored object.
 *
 * The row is removed first: a leftover object costs storage but is harmless,
 * whereas a row pointing at a deleted object renders as a broken image.
 */
const handle = async (
  request: Request,
  params: { imageId: string; projectId: string }
) => {
  try {
    if (!isSameOrigin(request)) {
      return errorResponse(403, "Cross-origin requests are not allowed.");
    }
    if (
      !safeParse(uuidSchema, params.projectId).success ||
      !safeParse(uuidSchema, params.imageId).success
    ) {
      return notFound();
    }

    const session = await requireUploader(request.headers);
    const project = await requireEditableProject(session, params.projectId);

    const [image] = await db
      .select({ id: projectImages.id, storageKey: projectImages.storageKey })
      .from(projectImages)
      .where(
        and(
          eq(projectImages.id, params.imageId),
          eq(projectImages.projectId, project.id)
        )
      )
      .limit(1);
    if (!image) {
      return notFound();
    }

    await db.delete(projectImages).where(eq(projectImages.id, image.id));
    await deleteObjects([image.storageKey]).catch(() => null);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      return errorResponse(
        HTTP_STATUS_BY_ACCESS_ERROR[error.code],
        error.message
      );
    }
    console.error("Image delete failed", error);
    return errorResponse(500, "The image could not be deleted.");
  }
};

export const Route = createFileRoute(
  "/api/projects/$projectId/images/$imageId"
)({
  server: {
    handlers: {
      // oxlint-disable-next-line sonarjs/function-name -- HTTP method names required by TanStack Start
      DELETE: async ({
        params,
        request,
      }: {
        params: { imageId: string; projectId: string };
        request: Request;
      }) => await handle(request, params),
    },
  },
});
