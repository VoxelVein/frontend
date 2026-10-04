import { IconArrowLeft } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import { PROJECT_TYPE_LABELS, PROJECT_TYPE_PATHS } from "@/lib/projects";
import type { ProjectType } from "@/lib/projects";

/**
 * "Back to mods" / "Back to servers", above a project's header.
 *
 * Its own file because two page components need it and neither should import
 * the other: the server page is deliberately not a variant of the download
 * page, so the link is the one thing they share.
 */
export const ProjectBackLink = ({ type }: { type: ProjectType }) => (
  <Link
    to={PROJECT_TYPE_PATHS[type]}
    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
  >
    <IconArrowLeft size={16} aria-hidden="true" />
    Back to {PROJECT_TYPE_LABELS[type].plural.toLowerCase()}
  </Link>
);
