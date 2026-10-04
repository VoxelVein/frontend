import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { projectImages } from "@/db/schema";
import type { ProjectImageKind } from "@/lib/projects";

/** The public URL a stored image is served from. */
export const imageUrl = (id: string): string => `/api/image/${id}`;

export interface ProjectImageView {
  height: number;
  id: string;
  url: string;
  width: number;
}

export interface ProjectImagesView {
  gallery: ProjectImageView[];
  icon: ProjectImageView | null;
}

interface ImageRow {
  height: number;
  id: string;
  kind: ProjectImageKind;
  width: number;
}

const toView = ({ height, id, width }: ImageRow): ProjectImageView => ({
  height,
  id,
  url: imageUrl(id),
  width,
});

/**
 * Splits a project's image rows into its single icon and its gallery.
 *
 * Order is the caller's: every query feeding this function orders by
 * `created_at` ascending, so the gallery comes out oldest first. Sorting here
 * would be redundant, and `id` is a uuid, which does not sort chronologically.
 */
export const toProjectImages = (rows: ImageRow[]): ProjectImagesView => {
  const gallery: ProjectImageView[] = [];
  let icon: ProjectImageView | null = null;
  for (const row of rows) {
    if (row.kind === "icon") {
      // A project has at most one icon, so the first one wins and a corrupt
      // row cannot produce two.
      icon ??= toView(row);
    } else {
      gallery.push(toView(row));
    }
  }
  return { gallery, icon };
};

/** A project's icon and gallery, oldest first. */
export const getProjectImages = async (
  projectId: string
): Promise<ProjectImagesView> => {
  const rows = await db
    .select({
      height: projectImages.height,
      id: projectImages.id,
      kind: projectImages.kind,
      width: projectImages.width,
    })
    .from(projectImages)
    .where(eq(projectImages.projectId, projectId))
    .orderBy(asc(projectImages.createdAt));
  return toProjectImages(rows);
};
