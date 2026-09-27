import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectBrowser,
  ProjectBrowserSkeleton,
} from "@/components/projects/project-browser";
import { loadProjectBrowser } from "@/lib/project-browser-loader";

const ServersPage = () => {
  const data = useLoaderData({ from: "/servers/" });
  return <ProjectBrowser type="server" {...data} />;
};

export const Route = createFileRoute("/servers/")({
  loader: () => loadProjectBrowser("server"),
  head: () => ({ meta: [{ title: "Servers — VoxelVein" }] }),
  component: ServersPage,
  pendingComponent: ProjectBrowserSkeleton,
});
