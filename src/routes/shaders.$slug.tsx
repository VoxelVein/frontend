import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectDetail,
  ProjectDetailSkeleton,
  ProjectNotFound,
} from "@/components/projects/project-detail";
import { getProject } from "@/lib/projects.functions";

const ShaderDetailPage = () => {
  const project = useLoaderData({ from: "/shaders/$slug" });
  if (!project) {
    return <ProjectNotFound type="shader" />;
  }
  return <ProjectDetail project={project} />;
};

export const Route = createFileRoute("/shaders/$slug")({
  loader: async ({ params }) => {
    const project = await getProject({ data: { slug: params.slug } }).catch(
      () => null
    );
    // A slug belongs to one project type; other types are not found here.
    return project?.type === "shader" ? project : null;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} — VoxelVein`
          : "Shader not found — VoxelVein",
      },
      ...(loaderData
        ? [{ content: loaderData.summary, name: "description" }]
        : []),
    ],
  }),
  component: ShaderDetailPage,
  pendingComponent: ProjectDetailSkeleton,
});
