import type { UrlTransform } from "@tanstack/markdown";

/**
 * Where author-written Markdown URLs stop being trusted.
 *
 * Post bodies are Markdown only. Raw HTML is deliberately left disabled, so
 * `@tanstack/markdown` turns author `<tags>` into escaped text and the renderer
 * never reaches its raw-HTML path. The remaining author-controlled values are
 * link and image destinations: a Markdown link is not an HTML node, so it never
 * passes through a markup sanitizer and has to be filtered as it is parsed.
 * `markdownUrlTransform` is that filter.
 *
 * This is a small allowlist, not a general URL parser: it is sound for the
 * on-site destinations a post actually uses, and unit tests cover each branch.
 */

/**
 * Whether a code point is one a browser discards from a URL.
 *
 * C0 controls and the C1 block, compared numerically rather than matched with a
 * regular expression: the literal characters are invisible in source and easy to
 * mangle in an editor, which is how a control-character class once turned this
 * file into a binary one.
 */
const isIgnoredUrlCharacter = (codePoint: number): boolean =>
  codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);

const stripIgnoredUrlCharacters = (url: string): string =>
  [...url]
    .filter(
      (character) => !isIgnoredUrlCharacter(character.codePointAt(0) ?? 0)
    )
    .join("");

/** A leading scheme, if the URL has one. */
const URL_SCHEME = /^(?<scheme>[a-z][\d+.a-z-]*):/iu;

/** Schemes a link or image may use. */
const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/**
 * Inline images, restricted to raster types.
 *
 * `data:` cannot carry script in a raster image, but `data:image/svg+xml` can:
 * SVG is a document format that may contain script. The restriction states that
 * intent instead of relying on every consumer to know the distinction.
 */
const SAFE_IMAGE_DATA_URL =
  /^data:image\/(?:avif|gif|jpeg|jpg|png|webp);base64,[a-z\d+/=\s]*$/iu;

/** Whether a URL may be used for a link or for an image. */
type UrlKind = "image" | "link";

/**
 * Returns the URL if it is safe to emit, or null to drop it.
 *
 * A dropped URL is not a hard failure: `@tanstack/markdown` treats null as
 * "render the link or image without a destination", so a bad URL costs one dead
 * link instead of taking down the post around it.
 */
const sanitizeUrl = (url: string, kind: UrlKind): string | null => {
  // Browsers drop control characters from a URL before resolving its scheme, so
  // `java\tscript:alert(1)` is a working `javascript:` URL. Removing them first
  // is what stops that bypass; checking the scheme on the raw string does not.
  const cleaned = stripIgnoredUrlCharacters(url).trim();

  if (cleaned === "") {
    return null;
  }

  if (kind === "image" && SAFE_IMAGE_DATA_URL.test(cleaned)) {
    return cleaned;
  }

  const scheme = URL_SCHEME.exec(cleaned)?.groups?.scheme;

  // No scheme means a relative reference: `/uploads/a.png`, `images/a.png`,
  // `#install`. These resolve against this site and cannot introduce a scheme,
  // so they are safe by construction.
  if (!scheme) {
    return cleaned;
  }

  return SAFE_SCHEMES.has(scheme.toLowerCase()) ? cleaned : null;
};

/** Applies `sanitizeUrl` to every URL in the Markdown source. */
const markdownUrlTransform: UrlTransform = (url, kind) =>
  sanitizeUrl(url, kind);

export { markdownUrlTransform, sanitizeUrl };
