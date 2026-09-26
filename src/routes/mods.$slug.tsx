import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectDetail,
  ProjectDetailSkeleton,
  ProjectNotFound,
} from "@/components/projects/project-detail";
import { getProject } from "@/lib/projects.functions";

const ModDetailPage = () => {
  const project = useLoaderData({ from: "/mods/$slug" });
  if (!project) {
    return <ProjectNotFound type="mod" />;
  }
  return <ProjectDetail project={project} />;
};

export const Route = createFileRoute("/mods/$slug")({
  loader: async ({ params }) => {
    const project = await getProject({ data: { slug: params.slug } }).catch(
      () => null
    );
    // A slug belongs to one project type; other types are not found here.
    return project?.type === "mod" ? project : null;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} — VoxelVein`
          : "Mod not found — VoxelVein",
      },
      ...(loaderData
        ? [{ content: loaderData.summary, name: "description" }]
        : []),
    ],
  }),
  component: ModDetailPage,
  pendingComponent: ProjectDetailSkeleton,
});
