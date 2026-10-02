import { notFound } from "@tanstack/react-router";

import type { ProjectType, ProjectView } from "@/lib/projects";
import { getProject } from "@/lib/projects.functions";

/**
 * Loader for a project's gallery route, shared by all six type routes.
 *
 * Every type has its own gallery path (`/mods/$slug/gallery` and so on) because
 * the project routes are per-type, but the work is identical, so it lives here
 * once.
 *
 * Throws `notFound()` rather than returning null. A null result would leave the
 * route rendering an empty page under a success status, which reads to both a
 * crawler and a screen reader as a gallery that exists and has nothing in it.
 * A project of the wrong type counts as missing too, matching the detail
 * routes: a slug belongs to exactly one type.
 */
export const galleryLoader = async (
  type: ProjectType,
  slug: string
): Promise<ProjectView> => {
  const project = await getProject({ data: { slug } }).catch(() => null);

  if (!project || project.type !== type || project.gallery.length === 0) {
    throw notFound();
  }

  return project;
};
