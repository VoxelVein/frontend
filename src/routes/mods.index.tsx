import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectBrowser,
  ProjectBrowserSkeleton,
} from "@/components/projects/project-browser";
import { loadProjectBrowser } from "@/lib/project-browser-loader";
import { SITE_DESCRIPTION, socialMeta } from "@/lib/site";

const ModsPage = () => {
  const data = useLoaderData({ from: "/mods/" });
  return <ProjectBrowser type="mod" {...data} />;
};

export const Route = createFileRoute("/mods/")({
  loader: () => loadProjectBrowser("mod"),
  head: ({ match }) => ({
    meta: [
      { title: "Mods | VoxelVein" },
      ...socialMeta({
        description: SITE_DESCRIPTION,
        path: match.pathname,
        title: "Mods | VoxelVein",
      }),
    ],
  }),
  component: ModsPage,
  pendingComponent: ProjectBrowserSkeleton,
});
