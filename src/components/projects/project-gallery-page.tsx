import { IconArrowLeft } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import { ProjectImage } from "@/components/projects/project-image";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectImageView } from "@/lib/project-images";
import { PROJECT_TYPE_PATHS } from "@/lib/projects";
import type { ProjectType } from "@/lib/projects";

interface ProjectGalleryPageProps {
  images: ProjectImageView[];
  projectName: string;
  slug: string;
  type: ProjectType;
}

/**
 * A project's gallery on its own page, at `/<type>/$slug/gallery`.
 *
 * The inline grid on the project page stays, so this is where someone goes to
 * see the images at full size with room to breathe. The route throws
 * `notFound()` when the project has no gallery, so the page is never reached
 * empty and does not need an empty state of its own.
 */
const ProjectGalleryPage = ({
  images,
  projectName,
  slug,
  type,
}: ProjectGalleryPageProps) => (
  <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
    <Link
      to={`${PROJECT_TYPE_PATHS[type]}/$slug`}
      params={{ slug }}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
    >
      <IconArrowLeft size={16} aria-hidden="true" />
      Back to {projectName}
    </Link>

    <header className="mt-4">
      <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
        {projectName} gallery
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {images.length === 1
          ? "1 screenshot. Open it for the full-size image."
          : `${images.length} screenshots. Open any of them for the full-size image.`}
      </p>
    </header>

    <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {images.map((image, index) => (
        <li key={image.id}>
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border focus-visible:ring-ring block overflow-hidden rounded-xl border focus-visible:ring-3 focus-visible:outline-none"
          >
            <ProjectImage
              image={image}
              alt={`${projectName} screenshot ${index + 1}`}
              // The first row is above the fold on every breakpoint, so the
              // leading images are eager and the rest stay lazy.
              priority={index < 3}
              ratio="square"
            />
          </a>
        </li>
      ))}
    </ul>
  </div>
);

/** Placeholder shown while the gallery loader runs. */
const ProjectGalleryPageSkeleton = () => (
  <div
    aria-busy="true"
    className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8"
  >
    <Skeleton className="h-11 w-48" />
    <Skeleton className="mt-4 h-9 w-72 max-w-full" />
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton className="aspect-square rounded-xl" />
      <Skeleton className="aspect-square rounded-xl" />
      <Skeleton className="aspect-square rounded-xl" />
    </div>
  </div>
);

export { ProjectGalleryPage, ProjectGalleryPageSkeleton };
