import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectDetail,
  ProjectDetailSkeleton,
  ProjectNotFound,
} from "@/components/projects/project-detail";
import { getProject } from "@/lib/projects.functions";
import { SITE_DESCRIPTION, socialMeta } from "@/lib/site";

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
  head: ({ loaderData, match }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} | VoxelVein`
          : "Plugin not found | VoxelVein",
      },
      ...(loaderData
        ? [{ content: loaderData.summary, name: "description" }]
        : []),
      ...socialMeta({
        description: loaderData?.summary ?? SITE_DESCRIPTION,
        path: match.pathname,
        title: loaderData
          ? `${loaderData.name} | VoxelVein`
          : "Plugin not found | VoxelVein",
      }),
    ],
  }),
  component: PluginDetailPage,
  pendingComponent: ProjectDetailSkeleton,
});
