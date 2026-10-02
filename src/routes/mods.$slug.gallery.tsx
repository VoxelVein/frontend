import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectGalleryPage,
  ProjectGalleryPageSkeleton,
} from "@/components/projects/project-gallery-page";
import { galleryLoader } from "@/lib/project-gallery.functions";

const GalleryPage = () => {
  const project = useLoaderData({ from: "/mods/$slug/gallery" });
  return (
    <ProjectGalleryPage
      images={project.gallery}
      projectName={project.name}
      slug={project.slug}
      type="mod"
    />
  );
};

export const Route = createFileRoute("/mods/$slug/gallery")({
  loader: ({ params }) => galleryLoader("mod", params.slug),
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
