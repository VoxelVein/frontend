import { ProjectImage } from "@/components/projects/project-image";
import type { ProjectImageView } from "@/lib/project-images";

/**
 * A project's gallery, laid out as a grid.
 *
 * Each image links to a full-size view rather than opening a new tab, so it
 * stays a real link and works without JavaScript. The first image is the
 * eagerly loaded one, since it is above the fold.
 */
export const ProjectGallery = ({
  images,
  projectName,
}: {
  images: ProjectImageView[];
  projectName: string;
}) => {
  if (images.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="gallery-heading" className="mt-10">
      <h2
        id="gallery-heading"
        className="text-foreground text-lg font-semibold"
      >
        Gallery
      </h2>
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
