import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectBrowser,
  ProjectBrowserSkeleton,
} from "@/components/projects/project-browser";
import { loadProjectBrowser } from "@/lib/project-browser-loader";

const DatapacksPage = () => {
  const data = useLoaderData({ from: "/datapacks/" });
  return <ProjectBrowser type="datapack" {...data} />;
};

export const Route = createFileRoute("/datapacks/")({
  loader: () => loadProjectBrowser("datapack"),
  head: () => ({ meta: [{ title: "Datapacks | VoxelVein" }] }),
  component: DatapacksPage,
  pendingComponent: ProjectBrowserSkeleton,
});
