import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectBrowser,
  ProjectBrowserSkeleton,
} from "@/components/projects/project-browser";
import { loadProjectBrowser } from "@/lib/project-browser-loader";

const ShadersPage = () => {
  const data = useLoaderData({ from: "/shaders/" });
  return <ProjectBrowser type="shader" {...data} />;
};

export const Route = createFileRoute("/shaders/")({
  loader: () => loadProjectBrowser("shader"),
  head: () => ({ meta: [{ title: "Shaders | VoxelVein" }] }),
  component: ShadersPage,
  pendingComponent: ProjectBrowserSkeleton,
});
