import type { ProjectImageView } from "@/lib/project-images";
import { cn } from "@/lib/utils";

interface ProjectImageProps {
  alt: string;
  className?: string;
  image: ProjectImageView | null;
  /**
   * Rendered in place of the image when the project has none. A letter tile
   * is the existing look, so it stays the default.
   */
  fallback?: React.ReactNode;
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
  priority = false,
  ratio = "natural",
}: ProjectImageProps) => {
  if (!image) {
    return fallback ?? null;
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
