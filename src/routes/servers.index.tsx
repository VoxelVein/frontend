import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectBrowser,
  ProjectBrowserSkeleton,
} from "@/components/projects/project-browser";
import { loadProjectBrowser } from "@/lib/project-browser-loader";
import { SITE_DESCRIPTION, socialMeta } from "@/lib/site";

const ServersPage = () => {
  const data = useLoaderData({ from: "/servers/" });
  return <ProjectBrowser type="server" {...data} />;
};

export const Route = createFileRoute("/servers/")({
  loader: () => loadProjectBrowser("server"),
  head: ({ match }) => ({
    meta: [
      { title: "Servers | VoxelVein" },
      ...socialMeta({
        description: SITE_DESCRIPTION,
        path: match.pathname,
        title: "Servers | VoxelVein",
      }),
    ],
  }),
  component: ServersPage,
  pendingComponent: ProjectBrowserSkeleton,
});
