import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectBrowser,
  ProjectBrowserSkeleton,
} from "@/components/projects/project-browser";
import { loadProjectBrowser } from "@/lib/project-browser-loader";
import { SITE_DESCRIPTION, socialMeta } from "@/lib/site";

const ShadersPage = () => {
  const data = useLoaderData({ from: "/shaders/" });
  return <ProjectBrowser type="shader" {...data} />;
};

export const Route = createFileRoute("/shaders/")({
  loader: () => loadProjectBrowser("shader"),
  head: ({ match }) => ({
    meta: [
      { title: "Shaders | VoxelVein" },
      ...socialMeta({
        description: SITE_DESCRIPTION,
        path: match.pathname,
        title: "Shaders | VoxelVein",
      }),
    ],
  }),
  component: ShadersPage,
  pendingComponent: ProjectBrowserSkeleton,
});
