import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectBrowser,
  ProjectBrowserSkeleton,
} from "@/components/projects/project-browser";
import { loadProjectBrowser } from "@/lib/project-browser-loader";

const ModsPage = () => {
  const data = useLoaderData({ from: "/mods/" });
  return <ProjectBrowser type="mod" {...data} />;
};

export const Route = createFileRoute("/mods/")({
  loader: () => loadProjectBrowser("mod"),
  head: () => ({ meta: [{ title: "Mods — VoxelVein" }] }),
  component: ModsPage,
  pendingComponent: ProjectBrowserSkeleton,
});
