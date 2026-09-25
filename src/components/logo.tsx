import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

/**
 * The VoxelVein mark.
 *
 * Rendered as a CSS mask over `/logo.svg` rather than an `<img>`, for two
 * reasons. The mark is monochrome — it was previously shipped as two raster
 * files, `logo-light.png` (#000) and `logo_dark.png` (#fff), swapped with
 * `dark:hidden`/`hidden dark:block`. One masked SVG replaces that pair and
 * themes from CSS alone. And the SVG embeds its artwork as a base64 raster, so
 * inlining it as JSX would push ~11KB of payload into the bundle; as a mask it
 * stays a single cached file fetch. The colour comes from `currentColor`, so the
 * mark inherits surrounding text and any caller can override with e.g.
 * `text-primary`.
 */
const Logo = ({ className }: LogoProps) => (
  <span
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- A masked mark has no semantic HTML equivalent. An <img> would resolve `currentColor` inside the SVG document rather than the page, so it could not follow the app-controlled theme from @lonik/themer; the mask is what makes the raster artwork themeable at all.
    role="img"
    aria-label="VoxelVein"
    className={cn(
      "inline-block size-4 bg-current",
      "[mask-image:url(/logo.svg)] [mask-size:contain] [mask-position:center] [mask-repeat:no-repeat]",
      className
    )}
  />
);

export { Logo };
