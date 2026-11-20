import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectBrowser,
  ProjectBrowserSkeleton,
} from "@/components/projects/project-browser";
import { loadProjectBrowser } from "@/lib/project-browser-loader";
import { SITE_DESCRIPTION, socialMeta } from "@/lib/site";

const ModpacksPage = () => {
  const data = useLoaderData({ from: "/modpacks/" });
  return <ProjectBrowser type="modpack" {...data} />;
};

export const Route = createFileRoute("/modpacks/")({
  loader: () => loadProjectBrowser("modpack"),
  head: ({ match }) => ({
    meta: [
      { title: "Modpacks | VoxelVein" },
      ...socialMeta({
        description: SITE_DESCRIPTION,
        path: match.pathname,
        title: "Modpacks | VoxelVein",
      }),
    ],
  }),
  component: ModpacksPage,
  pendingComponent: ProjectBrowserSkeleton,
});
