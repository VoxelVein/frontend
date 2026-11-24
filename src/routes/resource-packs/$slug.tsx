import { createFileRoute } from "@tanstack/react-router";

<<<<<<< Updated upstream
import { legacyProjectRedirect } from "@/lib/legacy-project-redirect";
=======
import {
  ProjectDetail,
  ProjectDetailSkeleton,
  ProjectNotFound,
} from "@/components/projects/project-detail";
import { getProject } from "@/lib/projects.functions";
import { SITE_DESCRIPTION, socialMeta } from "@/lib/site";

const ResourcePackDetailPage = () => {
  const project = useLoaderData({ from: "/resource-packs/$slug" });

  if (!project) {
    return <ProjectNotFound type="resourcepack" />;
  }

  return <ProjectDetail project={project} />;
};
>>>>>>> Stashed changes

/** Old project links keep working after the /p migration. */
export const Route = createFileRoute("/resource-packs/$slug")({
<<<<<<< Updated upstream
  beforeLoad: ({ location, params }) =>
    legacyProjectRedirect({
      searchStr: location.searchStr,
      slug: params.slug,
      type: "resourcepack",
    }),
=======
  loader: async ({ params }) => {
    const project = await getProject({ data: { slug: params.slug } }).catch(
      () => null
    );

    // A slug belongs to one project type; other types are not found here.
    return project?.type === "resourcepack" ? project : null;
  },
  head: ({ loaderData, match }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} | VoxelVein`
          : "Resource Pack not found | VoxelVein",
      },
      ...(loaderData
        ? [{ content: loaderData.summary, name: "description" }]
        : []),
      ...socialMeta({
        description: loaderData?.summary ?? SITE_DESCRIPTION,
        path: match.pathname,
        title: loaderData
          ? `${loaderData.name} | VoxelVein`
          : "Resource Pack not found | VoxelVein",
      }),
    ],
  }),
  component: ResourcePackDetailPage,
  pendingComponent: ProjectDetailSkeleton,
>>>>>>> Stashed changes
});
