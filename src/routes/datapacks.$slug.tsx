import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectDetail,
  ProjectDetailSkeleton,
  ProjectNotFound,
} from "@/components/projects/project-detail";
import { getProject } from "@/lib/projects.functions";

const DatapackDetailPage = () => {
  const project = useLoaderData({ from: "/datapacks/$slug" });
  if (!project) {
    return <ProjectNotFound type="datapack" />;
  }
  return <ProjectDetail project={project} />;
};

export const Route = createFileRoute("/datapacks/$slug")({
  loader: async ({ params }) => {
    const project = await getProject({ data: { slug: params.slug } }).catch(
      () => null
    );
    // A slug belongs to one project type; other types are not found here.
    return project?.type === "datapack" ? project : null;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} | VoxelVein`
          : "Datapack not found | VoxelVein",
      },
      ...(loaderData
        ? [{ content: loaderData.summary, name: "description" }]
        : []),
    ],
  }),
  component: DatapackDetailPage,
  pendingComponent: ProjectDetailSkeleton,
});
