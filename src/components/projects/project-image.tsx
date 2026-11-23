import { projectFallbackIconUrl } from "@/lib/project-fallback-icon";
import type { ProjectImageView } from "@/lib/project-images";
import { cn } from "@/lib/utils";

interface ProjectImageProps {
  alt: string;
  className?: string;
  image: ProjectImageView | null;
  /**
   * Rendered in place of the image when the project has none. Takes priority
   * over `fallbackSeed` for callers that need their own artwork.
   */
  fallback?: React.ReactNode;
  /** The project id (or slug) used to generate an identicon when there is no icon. */
  fallbackSeed?: string;
  /** Above the fold images should not be lazy, or they pop in after paint. */
  priority?: boolean;
  /**
   * "square" crops every image to a square, for grids where a uniform tile
   * matters more than the original proportions. The default keeps the
   * image's own ratio.
   */
  ratio?: "natural" | "square";
}

/**
 * Renders a stored project image, reserving its space before it loads.
 *
 * The stored width and height set an aspect ratio on the wrapper, so a slow
 * image does not shift the layout. Objects are stored exactly as uploaded and
 * are not resized, so the dimensions are also what the browser is told to
 * expect.
 */
export const ProjectImage = ({
  alt,
  className,
  image,
  fallback,
  fallbackSeed,
  priority = false,
  ratio = "natural",
}: ProjectImageProps) => {
  if (!image) {
    if (fallback) {
      return fallback;
    }

    if (!fallbackSeed) {
      return null;
    }

    // The wrapper carries the same size and border classes an uploaded image
    // would get, so swapping one for the other never shifts the layout.
    return (
      <div className={cn("bg-muted overflow-hidden", className)}>
        <img
          src={projectFallbackIconUrl(fallbackSeed)}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          className="size-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn("bg-muted overflow-hidden", className)}
      style={
        ratio === "square"
          ? undefined
          : { aspectRatio: `${image.width} / ${image.height}` }
      }
    >
      <img
        src={image.url}
        alt={alt}
        width={image.width}
        height={image.height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        // Fills the aspect-ratio box the wrapper reserves.
        className="h-full w-full object-cover"
      />
    </div>
  );
};
