import type { MarkdownDocument, UrlTransform } from "@tanstack/markdown";
import { sanitize as purify } from "isomorphic-dompurify";

/**
 * Where author-written blog content stops being trusted.
 *
 * Posts accept Markdown *and* raw HTML, and a raw HTML post is as dangerous as a
 * `<script>` in a database field. Nothing here sanitizes the rendered output
 * wholesale: `@tanstack/markdown` re-emits author HTML through
 * `dangerouslySetInnerHTML`, so the only safe place to intervene is the author
 * HTML itself, before it reaches the renderer. `sanitizeMarkdownDocument` is
 * that intervention, and it is applied to the parsed tree rather than to the
 * final markup so that everything Markdown itself produced — links, images,
 * emphasis — keeps its own escaping and styling.
 *
 * Two independent checks apply, because the two halves of a post arrive by
 * different routes:
 *
 * 1. `sanitizeHtml` runs over embedded HTML blocks and inlines.
 * 2. `markdownUrlTransform` runs over the URL in every Markdown `[a](b)` and
 *    `![a](b)`, which never becomes an HTML node and so never reaches (1).
 *
 * Each is sufficient on its own for its own route; neither covers the other.
 */

/**
 * Elements a post may contain.
 *
 * An allowlist, not a denylist: anything not named here is dropped, including
 * anything added to HTML since this list was written. Inline formatting,
 * structure, tables, figures, and the details/summary pair are allowed because
 * posts legitimately use them. `script`, `style`, `link`, `iframe`, `object`,
 * `embed`, `form`, `input`, `button`, `base`, and `meta` are absent — the first
 * two execute code, the next three load or embed foreign documents, and the
 * rest either execute code or let a post impersonate a page control.
 */
const ALLOWED_TAGS = [
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "details",
  "dfn",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "u",
  "ul",
  "var",
  "wbr",
];

/**
 * Attributes a post may carry.
 *
 * No `on*` handler, no `style`, no `id`/`name`, and no `target`.
 *
 * * `style` is excluded because it is a scripting-adjacent primitive: it can
 *   overlay an element over the whole viewport, hide real content behind
 *   transparent text, or exfiltrate a query string through a background URL.
 * * `id` and `name` are excluded because they let a post clobber the properties
 *   named by globals and DOM lookups, which turns any code that reads
 *   `window.something` into a value the post controls.
 * * `target` is excluded because a post has no business forcing a new tab, and
 *   allowing it would mean promising a `rel="noopener"` this layer cannot add
 *   without a global DOMPurify hook. Same-tab links are the safe default.
 *
 * `aria-*` is off too (`ALLOW_ARIA_ATTR: false` below). A post is prose: there
 * is nothing in it that needs a role override, and the usual reason to add one
 * is to make injected content invisible to assistive technology.
 */
const ALLOWED_ATTR = [
  // Global, and safe on any element: `class` carries the language-* markers that
  // style code blocks, `title` carries the native tooltip.
  "class",
  "title",
  // Text semantics.
  "cite",
  "datetime",
  "abbr",
  // Lists: an author starting an ordered list at 7 must be able to say so.
  "start",
  "reversed",
  "value",
  // Tables. `scope` is the one that matters: without it a screen reader cannot
  // tell a column header from a row header.
  "colspan",
  "rowspan",
  "scope",
  // Images.
  "alt",
  "src",
  "width",
  "height",
  "loading",
  "decoding",
  // Links.
  "href",
  "rel",
  // Details.
  "open",
];

/**
 * Second line of defence, behind the allowlist.
 *
 * Every name here is already outside `ALLOWED_TAGS` or `ALLOWED_ATTR`, so today
 * this changes nothing. It is here so the guarantee is readable in one place and
 * so widening the allowlists above cannot silently reintroduce them.
 */
const FORBID_TAGS = [
  "base",
  "embed",
  "form",
  "iframe",
  "input",
  "link",
  "meta",
  "object",
  "script",
  "style",
];

const FORBID_ATTR = ["id", "name", "srcset", "style", "target"];

const SANITIZE_CONFIG = {
  ALLOWED_ATTR,
  ALLOWED_TAGS,
  ALLOW_ARIA_ATTR: false,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  FORBID_ATTR,
  FORBID_TAGS,
  SANITIZE_DOM: true,
} as const;

/**
 * Strips everything unsafe from a fragment of author-written HTML.
 *
 * DOMPurify parses the fragment in a document of its own and re-serialises it,
 * which is what closes off mutation XSS: an element that only becomes dangerous
 * after the browser re-parses it, such as an SVG `<style>` or a `<math>` payload,
 * is destroyed by the round trip rather than passed through.
 */
const sanitizeHtml = (html: string): string => purify(html, SANITIZE_CONFIG);

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
 * `data:` is permitted by DOMPurify on `img` and so it is permitted here too,
 * rather than leaving the two layers disagreeing about the same attribute. The
 * restriction to base64 raster formats is stricter than DOMPurify's own rule and
 * is why `data:image/svg+xml` is rejected: SVG can carry script, and a raster
 * filter states that intent instead of relying on every consumer to know why
 * `data:` on an `<img>` is otherwise tolerable.
 */
const SAFE_IMAGE_DATA_URL =
  /^data:image\/(?:avif|gif|jpeg|jpg|png|webp);base64,[A-Za-z\d+/=\s]*$/iu;

/** Whether a URL may be used for a link or for an image. */
type UrlKind = "image" | "link";

/**
 * Returns the URL if it is safe to emit, or null to drop it.
 *
 * A dropped URL is not a hard failure: DOMPurify and `@tanstack/markdown` both
 * treat null as "render the link or image without a destination", so a bad URL
 * costs one dead link instead of taking down the post around it.
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

/**
 * Applies `sanitizeUrl` to every URL in the Markdown source.
 *
 * Needed because a Markdown link is not HTML: `[click](javascript:alert(1))`
 * produces a link node, never a raw HTML fragment, so DOMPurify never sees it.
 */
const markdownUrlTransform: UrlTransform = (url, kind) =>
  sanitizeUrl(url, kind);

/**
 * A node in a parsed Markdown tree, narrowed to the fields this walk reads.
 *
 * Structural rather than the library's node union, and that is deliberate. The
 * union would say exactly which node types exist today, but a walk written
 * against it silently stops covering anything a later release adds — and for a
 * security boundary, "not covered" means "trusted". Naming the child collections
 * instead means a new node is walked as long as it hangs off one of them.
 *
 * The child collections are all four the renderer traverses. `children` alone is
 * not enough: `TableNode` has no `children`, and it holds cells in `header` and
 * `rows`, so a table cell's inline HTML sits outside `children` entirely.
 */
interface MarkdownTreeNode {
  children?: MarkdownTreeNode[];
  header?: MarkdownTreeNode[];
  items?: MarkdownTreeNode[];
  rows?: MarkdownTreeNode[][];
  /** Optional because `FootnoteItemNode` has none — it is a container only. */
  type?: string;
  value?: string;
}

/**
 * Node types whose `value` the React renderer emits as raw HTML.
 *
 * Both are needed and they are easy to conflate: the renderer switches on `'html'`
 * for block-level markup and `'inlineHtml'` for markup inside a paragraph, and
 * each reaches `dangerouslySetInnerHTML` separately. Missing the second one leaves
 * every inline tag — the common case in prose — completely unsanitized.
 */
const RAW_HTML_NODE_TYPES = new Set(["html", "inlineHtml"]);

const sanitizeHtmlNodes = (node: MarkdownTreeNode): void => {
  // A node with no `type` is a pure container, so it carries no author markup.
  if (node.value !== undefined && RAW_HTML_NODE_TYPES.has(node.type ?? "")) {
    node.value = sanitizeHtml(node.value);
  }

  for (const child of node.children ?? []) {
    sanitizeHtmlNodes(child);
  }

  for (const item of node.items ?? []) {
    sanitizeHtmlNodes(item);
  }

  for (const cell of node.header ?? []) {
    sanitizeHtmlNodes(cell);
  }

  for (const row of node.rows ?? []) {
    for (const cell of row) {
      sanitizeHtmlNodes(cell);
    }
  }
};

/**
 * A parsed document whose embedded HTML is safe to render.
 *
 * Mutates the document it is given, because the parser has just produced it and
 * there is no second consumer of it.
 */
const sanitizeMarkdownDocument = (
  document: MarkdownDocument
): MarkdownDocument => {
  sanitizeHtmlNodes(document);

  return document;
};

/** The `urlTransform` that `parseMarkdown` should be called with. */
export {
  markdownUrlTransform,
  sanitizeHtml,
  sanitizeMarkdownDocument,
  sanitizeUrl,
};
