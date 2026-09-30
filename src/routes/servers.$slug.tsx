import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectDetail,
  ProjectDetailSkeleton,
  ProjectNotFound,
} from "@/components/projects/project-detail";
import { getProject } from "@/lib/projects.functions";

const ServerDetailPage = () => {
  const project = useLoaderData({ from: "/servers/$slug" });
  if (!project) {
    return <ProjectNotFound type="server" />;
  }
  return <ProjectDetail project={project} />;
};

export const Route = createFileRoute("/servers/$slug")({
  loader: async ({ params }) => {
    const project = await getProject({ data: { slug: params.slug } }).catch(
      () => null
    );
    // A slug belongs to one project type; other types are not found here.
    return project?.type === "server" ? project : null;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} | VoxelVein`
          : "Server not found | VoxelVein",
      },
      ...(loaderData
        ? [{ content: loaderData.summary, name: "description" }]
        : []),
    ],
  }),
  component: ServerDetailPage,
  pendingComponent: ProjectDetailSkeleton,
});
