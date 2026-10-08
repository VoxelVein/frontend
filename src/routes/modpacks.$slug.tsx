import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectDetail,
  ProjectDetailSkeleton,
  ProjectNotFound,
} from "@/components/projects/project-detail";
import { getProject } from "@/lib/projects.functions";
import { SITE_DESCRIPTION, socialMeta } from "@/lib/site";

const ModpackDetailPage = () => {
  const project = useLoaderData({ from: "/modpacks/$slug" });
  if (!project) {
    return <ProjectNotFound type="modpack" />;
  }
  return <ProjectDetail project={project} />;
};

export const Route = createFileRoute("/modpacks/$slug")({
  loader: async ({ params }) => {
    const project = await getProject({ data: { slug: params.slug } }).catch(
      () => null
    );
    // A slug belongs to one project type; other types are not found here.
    return project?.type === "modpack" ? project : null;
  },
  head: ({ loaderData, match }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} | VoxelVein`
          : "Modpack not found | VoxelVein",
      },
      ...(loaderData
        ? [{ content: loaderData.summary, name: "description" }]
        : []),
      ...socialMeta({
        description: loaderData?.summary ?? SITE_DESCRIPTION,
        path: match.pathname,
        title: loaderData
          ? `${loaderData.name} | VoxelVein`
          : "Modpack not found | VoxelVein",
      }),
    ],
  }),
  component: ModpackDetailPage,
  pendingComponent: ProjectDetailSkeleton,
});
