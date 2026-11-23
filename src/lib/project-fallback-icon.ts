/**
 * A deterministic identicon for a project without an uploaded icon.
 *
 * The seed is the project's own id, so the same project always gets the same
 * picture and two projects sharing a name never share an icon. DiceBear
 * serves the SVG directly; it is not stored in our object storage.
 */
export const projectFallbackIconUrl = (seed: string): string =>
  `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(seed)}`;
