import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectDetail,
  ProjectDetailSkeleton,
  ProjectNotFound,
} from "@/components/projects/project-detail";
import { getProject } from "@/lib/projects.functions";

const ResourcePackDetailPage = () => {
  const project = useLoaderData({ from: "/resource-packs/$slug" });
  if (!project) {
    return <ProjectNotFound type="resourcepack" />;
  }
  return <ProjectDetail project={project} />;
};

export const Route = createFileRoute("/resource-packs/$slug")({
  loader: async ({ params }) => {
    const project = await getProject({ data: { slug: params.slug } }).catch(
      () => null
    );
    // A slug belongs to one project type; other types are not found here.
    return project?.type === "resourcepack" ? project : null;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} — VoxelVein`
          : "Resource Pack not found — VoxelVein",
      },
      ...(loaderData
        ? [{ content: loaderData.summary, name: "description" }]
        : []),
    ],
  }),
  component: ResourcePackDetailPage,
  pendingComponent: ProjectDetailSkeleton,
});
