import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectBrowser,
  ProjectBrowserSkeleton,
} from "@/components/projects/project-browser";
import { loadProjectBrowser } from "@/lib/project-browser-loader";

const PluginsPage = () => {
  const data = useLoaderData({ from: "/plugins/" });
  return <ProjectBrowser type="plugin" {...data} />;
};

export const Route = createFileRoute("/plugins/")({
  loader: () => loadProjectBrowser("plugin"),
  head: () => ({ meta: [{ title: "Plugins — VoxelVein" }] }),
  component: PluginsPage,
  pendingComponent: ProjectBrowserSkeleton,
});
