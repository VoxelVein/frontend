import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectGalleryPage,
  ProjectGalleryPageSkeleton,
} from "@/components/projects/project-gallery-page";
import { galleryLoader } from "@/lib/project-gallery.functions";
import { SITE_DESCRIPTION, socialMeta } from "@/lib/site";

const GalleryPage = () => {
  const project = useLoaderData({ from: "/plugins/$slug/gallery" });
  return (
    <ProjectGalleryPage
      images={project.gallery}
      projectName={project.name}
      slug={project.slug}
      type="plugin"
    />
  );
};

export const Route = createFileRoute("/plugins/$slug/gallery")({
  loader: ({ params }) => galleryLoader("plugin", params.slug),
  head: ({ loaderData, match }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} gallery | VoxelVein`
          : "Gallery not found | VoxelVein",
      },
      ...socialMeta({
        description: loaderData?.summary ?? SITE_DESCRIPTION,
        path: match.pathname,
        title: loaderData
          ? `${loaderData.name} gallery | VoxelVein`
          : "Gallery not found | VoxelVein",
      }),
    ],
  }),
  component: GalleryPage,
  pendingComponent: ProjectGalleryPageSkeleton,
});
