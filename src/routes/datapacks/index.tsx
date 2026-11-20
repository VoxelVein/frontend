import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectBrowser,
  ProjectBrowserSkeleton,
} from "@/components/projects/project-browser";
import { loadProjectBrowser } from "@/lib/project-browser-loader";
import { SITE_DESCRIPTION, socialMeta } from "@/lib/site";

const DatapacksPage = () => {
  const data = useLoaderData({ from: "/datapacks/" });
  return <ProjectBrowser type="datapack" {...data} />;
};

export const Route = createFileRoute("/datapacks/")({
  loader: () => loadProjectBrowser("datapack"),
  head: ({ match }) => ({
    meta: [
      { title: "Datapacks | VoxelVein" },
      ...socialMeta({
        description: SITE_DESCRIPTION,
        path: match.pathname,
        title: "Datapacks | VoxelVein",
      }),
    ],
  }),
  component: DatapacksPage,
  pendingComponent: ProjectBrowserSkeleton,
});
