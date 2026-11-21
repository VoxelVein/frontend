import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

const LEFT_LOBE =
  "M5.258 42.839c11.83 0 21.419-9.59 21.419-21.42S17.087 0 5.257 0c-11.829 0 .001 9.59.001 21.42 0 11.829-11.83 21.419 0 21.419";

const RIGHT_LOBE =
  "M42.742 42.839c-11.83 0-21.419-9.59-21.419-21.42S30.913 0 42.743 0c11.829 0-.001 9.59-.001 21.42 0 11.829 11.83 21.419 0 21.419";

/**
 * The VoxelVein mark.
 *
 * An inline SVG rather than a CSS mask over `logo.svg`. The mask used a
 * theme-dependent `mask-image` built at render time, which Tailwind cannot emit
 * because the class is not statically present, so the span fell back to a solid
 * `bg-current` square. Switching the mask on the resolved theme also made SSR
 * disagree with the client whenever the theme resolved to dark.
 *
 * The lobes inherit `currentColor`, so a caller can tint the mark with
 * `text-primary` or any surrounding text colour. The centre circle uses the
 * page background, which is what gives the mark its notch in both themes: the
 * artwork fills the circle with white in light mode and black in dark mode so
 * it disappears into each background.
 */
const Logo = ({ className }: LogoProps) => (
  <svg
    aria-label="VoxelVein"
    className={cn("size-4", className)}
    fill="none"
    role="img"
    viewBox="0 0 48 43"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d={LEFT_LOBE} fill="currentColor" />
    <path d={RIGHT_LOBE} fill="currentColor" />
    <circle cx="24" cy="21.421" fill="var(--background)" r="5.355" />
  </svg>
);

export { Logo };
