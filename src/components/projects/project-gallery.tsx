import { IconPhoto } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import { ProjectImage } from "@/components/projects/project-image";
import type { ProjectImageView } from "@/lib/project-images";
import { PROJECT_TYPE_PATHS } from "@/lib/projects";
import type { ProjectType } from "@/lib/projects";

/**
 * A project's gallery, laid out as a grid.
 *
 * Each image links to a full-size view rather than opening a new tab, so it
 * stays a real link and works without JavaScript. The first image is the
 * eagerly loaded one, since it is above the fold.
 *
 * Returns `null` when there are no images. Most projects have no gallery, and
 * an empty section on every project page would be noise rather than
 * information — the absence of the section is the signal. The gallery route
 * throws a 404 for the same reason.
 */
export const ProjectGallery = ({
  images,
  projectName,
  slug,
  type,
}: {
  images: ProjectImageView[];
  projectName: string;
  slug: string;
  type: ProjectType;
}) => {
  if (images.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="gallery-heading" className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="gallery-heading"
          className="text-foreground text-lg font-semibold"
        >
          Gallery
        </h2>

        <Link
          to={`${PROJECT_TYPE_PATHS[type]}/$slug/gallery`}
          params={{ slug }}
          className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          <IconPhoto size={16} aria-hidden="true" />
          View all {images.length}
        </Link>
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image, index) => (
          <li key={image.id}>
            <a
              href={image.url}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border focus-visible:ring-ring block overflow-hidden rounded-lg border focus-visible:ring-3 focus-visible:outline-none"
            >
              <ProjectImage
                image={image}
                alt={`${projectName} screenshot ${index + 1}`}
                priority={index === 0}
                ratio="square"
                className="aspect-square"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};
