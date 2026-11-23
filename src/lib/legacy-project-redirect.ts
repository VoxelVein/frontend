import { redirect } from "@tanstack/react-router";

import { PROJECT_TYPE_PATHS } from "@/lib/projects";
import type { ProjectType } from "@/lib/projects";

/**
 * Redirects the old top-level project URLs to their `/p/` replacement.
 *
 * Kept deliberately as `href` redirects: the old routes are only letterboxes
 * for bookmarks and search results, and rebuilding a typed `to` for each of
 * the 21 legacy routes would make these files a copy of the route tree.
 */
export const legacyProjectRedirect = ({
  gallery = false,
  searchStr = "",
  slug,
  type,
}: {
  gallery?: boolean;
  searchStr?: string;
  slug?: string;
  type: ProjectType;
}): never => {
  const path = slug
    ? `${PROJECT_TYPE_PATHS[type]}/${slug}${gallery ? "/gallery" : ""}`
    : PROJECT_TYPE_PATHS[type];

  throw redirect({ href: `${path}${searchStr}` });
};
