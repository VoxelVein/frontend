import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectBrowser,
  ProjectBrowserSkeleton,
} from "@/components/projects/project-browser";
import { loadProjectBrowser } from "@/lib/project-browser-loader";

const ModpacksPage = () => {
  const data = useLoaderData({ from: "/modpacks/" });
  return <ProjectBrowser type="modpack" {...data} />;
};

export const Route = createFileRoute("/modpacks/")({
  loader: () => loadProjectBrowser("modpack"),
  head: () => ({ meta: [{ title: "Modpacks — VoxelVein" }] }),
  component: ModpacksPage,
  pendingComponent: ProjectBrowserSkeleton,
});
