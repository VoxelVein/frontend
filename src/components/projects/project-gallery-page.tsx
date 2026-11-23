import {
  ProjectDetailPageFrame,
  ProjectGalleryBackLink,
} from "@/components/projects/project-detail-layout";
import { ProjectImage } from "@/components/projects/project-image";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectImageView } from "@/lib/project-images";
import type { ProjectType } from "@/lib/projects";

interface ProjectGalleryPageProps {
  images: ProjectImageView[];
  projectName: string;
  slug: string;
  type: ProjectType;
}

/**
 * A project's gallery on its own page, at `/p/<type>/$slug/gallery`.
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
  <ProjectDetailPageFrame>
    <ProjectGalleryBackLink projectName={projectName} slug={slug} type={type} />

    <header className="border-border bg-card relative mt-4 overflow-hidden rounded-2xl border p-5 sm:p-8">
      <div
        aria-hidden="true"
        className="from-primary/10 absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l to-transparent"
      />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
            Project gallery
          </p>
          <h1 className="text-foreground mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {projectName}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {images.length === 1
              ? "1 screenshot · open it for the full-size image"
              : `${images.length} screenshots · open any for the full-size image`}
          </p>
        </div>
        <span className="border-border bg-background/70 text-muted-foreground inline-flex min-h-9 w-fit items-center rounded-md border px-3 text-sm font-medium tabular-nums">
          {images.length} {images.length === 1 ? "image" : "images"}
        </span>
      </div>
    </header>

    <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {images.map((image, index) => (
        <li key={image.id}>
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border focus-visible:ring-ring bg-card block overflow-hidden rounded-xl border shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:outline-none motion-reduce:transform-none motion-reduce:transition-none"
          >
            <ProjectImage
              image={image}
              alt={`${projectName} screenshot ${index + 1}`}
              priority={index < 3}
              ratio="square"
            />
          </a>
        </li>
      ))}
    </ul>
  </ProjectDetailPageFrame>
);

/** Placeholder shown while the gallery loader runs. */
const ProjectGalleryPageSkeleton = () => (
  <div
    aria-busy="true"
    className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8 lg:py-10"
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
