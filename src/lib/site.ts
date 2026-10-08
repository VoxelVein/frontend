/**
 * The one place the site names itself.
 *
 * These strings are inlined at build time, so a wrong host here ships bad
 * social previews until the next deploy: `VITE_SITE_URL` must be set for real
 * deployments. See `docs/development/setup.md`.
 */

export const SITE_NAME = "VoxelVein";
export const SITE_TITLE =
  "VoxelVein | Free & Open-Source Minecraft Mod Platform";
// The list matched the hero's own copy rather than the category registry, and
// had already drifted: it omitted datapacks. This description is the one string
// a visitor reads without ever loading the page, so it leads with the promise
// and names the breadth instead of enumerating seven nouns a search result
// truncates anyway.
export const SITE_DESCRIPTION =
  "Find, download, and share Minecraft mods, plugins, modpacks, resource packs, shaders, datapacks, and servers. Free and open source, forever.";

// Absolute origin, no trailing slash. Read from import.meta.env rather than
// env.config so the value is inlined at build time and available during SSR
// and client navigation alike.
// SAFETY: Vite exposes VITE_* vars as `any`; narrowing to string | undefined
// matches the runtime value (string when set, undefined when absent).
export const SITE_URL = (
  (import.meta.env.VITE_SITE_URL as string | undefined) ??
  "http://localhost:3000"
).replace(/\/$/u, "");

interface SocialMetaOptions {
  /** Page summary. Omit to keep the root site-level description. */
  description?: string;
  /** Route path starting with `/`, so `${SITE_URL}${path}` is the page URL. */
  path: string;
  /** Matches the page's own `<title>`. */
  title: string;
  type?: "article" | "profile" | "website";
}

/**
 * The Open Graph and Twitter meta for one page.
 *
 * The root document already sets `og:site_name`, `og:locale` and the share
 * card type, so only the page-specific values are emitted here. TanStack's head
 * merging keeps the deepest route's value per tag, which is exactly what makes
 * "root default, per-route override" work without duplicates.
 */
export const socialMeta = ({
  description,
  path,
  title,
  type = "website",
}: SocialMetaOptions) => {
  const url = `${SITE_URL}${path}`;

  return [
    { property: "og:url", content: url },
    { property: "og:title", content: title },
    { property: "og:type", content: type },
    ...(description
      ? [{ property: "og:description", content: description }]
      : []),
    { name: "twitter:title", content: title },
    { name: "twitter:url", content: url },
    ...(description
      ? [{ name: "twitter:description", content: description }]
      : []),
  ];
};
