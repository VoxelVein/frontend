import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectGalleryPage,
  ProjectGalleryPageSkeleton,
} from "@/components/projects/project-gallery-page";
import { galleryLoader } from "@/lib/project-gallery.functions";

const GalleryPage = () => {
  const project = useLoaderData({ from: "/servers/$slug/gallery" });
  return (
    <ProjectGalleryPage
      images={project.gallery}
      projectName={project.name}
      slug={project.slug}
      type="server"
    />
  );
};

export const Route = createFileRoute("/servers/$slug/gallery")({
  loader: ({ params }) => galleryLoader("server", params.slug),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} gallery | VoxelVein`
          : "Gallery not found | VoxelVein",
      },
    ],
  }),
  component: GalleryPage,
  pendingComponent: ProjectGalleryPageSkeleton,
});
