import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectBrowser,
  ProjectBrowserSkeleton,
} from "@/components/projects/project-browser";
import { loadProjectBrowser } from "@/lib/project-browser-loader";
import { SITE_DESCRIPTION, socialMeta } from "@/lib/site";

const PluginsPage = () => {
  const data = useLoaderData({ from: "/plugins/" });
  return <ProjectBrowser type="plugin" {...data} />;
};

export const Route = createFileRoute("/plugins/")({
  loader: () => loadProjectBrowser("plugin"),
  head: ({ match }) => ({
    meta: [
      { title: "Plugins | VoxelVein" },
      ...socialMeta({
        description: SITE_DESCRIPTION,
        path: match.pathname,
        title: "Plugins | VoxelVein",
      }),
    ],
  }),
  component: PluginsPage,
  pendingComponent: ProjectBrowserSkeleton,
});
