import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectBrowser,
  ProjectBrowserSkeleton,
} from "@/components/projects/project-browser";
import { loadProjectBrowser } from "@/lib/project-browser-loader";

const ResourcePacksPage = () => {
  const data = useLoaderData({ from: "/resource-packs/" });
  return <ProjectBrowser type="resourcepack" {...data} />;
};

export const Route = createFileRoute("/resource-packs/")({
  loader: () => loadProjectBrowser("resourcepack"),
  head: () => ({ meta: [{ title: "Resource Packs — VoxelVein" }] }),
  component: ResourcePacksPage,
  pendingComponent: ProjectBrowserSkeleton,
});
