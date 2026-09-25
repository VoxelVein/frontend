import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectDetail,
  ProjectDetailSkeleton,
  ProjectNotFound,
} from "@/components/projects/project-detail";
import { getProject } from "@/lib/projects.functions";

const PluginDetailPage = () => {
  const project = useLoaderData({ from: "/plugins/$slug" });
  if (!project) {
    return <ProjectNotFound type="plugin" />;
  }
  return <ProjectDetail project={project} />;
};

export const Route = createFileRoute("/plugins/$slug")({
  loader: async ({ params }) => {
    const project = await getProject({ data: { slug: params.slug } }).catch(
      () => null
    );
    // A slug belongs to one project type; other types are not found here.
    return project?.type === "plugin" ? project : null;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} — VoxelVein`
          : "Plugin not found — VoxelVein",
      },
      ...(loaderData
        ? [{ content: loaderData.summary, name: "description" }]
        : []),
    ],
  }),
  component: PluginDetailPage,
  pendingComponent: ProjectDetailSkeleton,
});
