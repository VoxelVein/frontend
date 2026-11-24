import { createFileRoute } from "@tanstack/react-router";

<<<<<<< Updated upstream
import { legacyProjectRedirect } from "@/lib/legacy-project-redirect";
=======
import {
  ProjectGalleryPage,
  ProjectGalleryPageSkeleton,
} from "@/components/projects/project-gallery-page";
import { galleryLoader } from "@/lib/project-gallery.functions";
import { SITE_DESCRIPTION, socialMeta } from "@/lib/site";

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
>>>>>>> Stashed changes

/** Old gallery links keep working after the /p migration. */
export const Route = createFileRoute("/modpacks/$slug/gallery")({
  beforeLoad: ({ location, params }) =>
    legacyProjectRedirect({
      gallery: true,
      searchStr: location.searchStr,
      slug: params.slug,
      type: "modpack",
    }),
});
