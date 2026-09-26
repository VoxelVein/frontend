/**
 * Whether a redirect target is a path on this site. Only relative paths are
 * accepted: "//host" and "/\host" are protocol-relative URLs to other sites
 * in browsers, so a crafted link could otherwise bounce users elsewhere.
 */
export const isSafeRedirect = (target: string | undefined): target is string =>
  typeof target === "string" &&
  target.startsWith("/") &&
  !target.startsWith("//") &&
  !target.startsWith("/\\");

/** The redirect target when it is safe, otherwise the fallback path. */
export const getSafeRedirect = (
  target: string | undefined,
  fallback: string
): string => (isSafeRedirect(target) ? target : fallback);
