import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import {
  ProjectGalleryPage,
  ProjectGalleryPageSkeleton,
} from "@/components/projects/project-gallery-page";
import { galleryLoader } from "@/lib/project-gallery.functions";

const GalleryPage = () => {
  const project = useLoaderData({ from: "/modpacks/$slug/gallery" });
  return (
    <ProjectGalleryPage
      images={project.gallery}
      projectName={project.name}
      slug={project.slug}
      type="modpack"
    />
  );
};

export const Route = createFileRoute("/modpacks/$slug/gallery")({
  loader: ({ params }) => galleryLoader("modpack", params.slug),
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
