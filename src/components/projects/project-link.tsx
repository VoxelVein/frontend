import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { ProjectType } from "@/lib/projects";

interface ProjectLinkProps {
  children: ReactNode;
  className?: string;
  slug: string;
  type: ProjectType;
}

/** Links to a project's public page, which lives under its type's section. */
export const ProjectLink = ({
  children,
  className,
  slug,
  type,
}: ProjectLinkProps) => {
  if (type === "plugin") {
    return (
      <Link
        to="/plugins/$slug"
        params={{ slug }}
        preload="intent"
        className={className}
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      to="/mods/$slug"
      params={{ slug }}
      preload="intent"
      className={className}
    >
      {children}
    </Link>
  );
};
