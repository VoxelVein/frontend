import {
  boolean,
  check,
  nonEmpty,
  object,
  optional,
  pipe,
  string,
} from "valibot";

export interface PostSummary {
  createdAt: Date | string;
  excerpt: string | null;
  id: string;
  preview: string;
  published: boolean;
  slug: string;
  title: string;
  updatedAt: Date | string;
}

export interface Post extends PostSummary {
  authorId: string;
  content: string;
}

export interface PostInput {
  content: string;
  excerpt?: string;
  published: boolean;
  slug: string;
  title: string;
}

export const postTitleSchema = pipe(string(), nonEmpty("Title is required."));

export const postSlugSchema = pipe(
  string(),
  nonEmpty("Slug is required."),
  check(
    (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value),
    "Use lowercase letters, numbers, and hyphens."
  )
);

export const postContentSchema = pipe(
  string(),
  nonEmpty("Content is required.")
);

export const postInputSchema = object({
  content: postContentSchema,
  excerpt: optional(string()),
  published: boolean(),
  slug: postSlugSchema,
  title: postTitleSchema,
});

export const postUpdateSchema = object({
  content: postContentSchema,
  excerpt: optional(string()),
  id: string(),
  published: boolean(),
  slug: postSlugSchema,
  title: postTitleSchema,
});

export const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");

// ── Card preview ────────────────────────────────────────────────────────────
// Post cards show a short plain-text teaser. A manual excerpt always wins; when
// an author leaves it blank the teaser is derived from the Markdown body so
// every post still renders something.

const PREVIEW_MAX_LENGTH = 180;
const ELLIPSIS = "…";
/** Only break on a word boundary if it is reasonably close to the limit. */
const MIN_WORD_BREAK_RATIO = 0.6;

const FENCED_CODE = /```[\s\S]*?```/gu;
// Captures the wrapped text so identifiers such as `WEBHOOK_SECRET` survive
// into the teaser instead of collapsing to a blank.
const INLINE_CODE = /`(?<code>[^`]*)`/gu;
const IMAGE = /!\[(?<alt>[^\]]*)\]\([^)]*\)/gu;
const LINK = /\[(?<text>[^\]]*)\]\([^)]*\)/gu;
const HEADING = /^\s{0,3}#{1,6}\s+/gmu;
const BLOCKQUOTE = /^\s{0,3}>\s?/gmu;
const LIST_MARKER = /^\s{0,3}(?:[-*+]|\d+[.)])\s+/gmu;
const HORIZONTAL_RULE = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/gmu;
const HTML_TAG = /<[^>]+>/gu;
const STRONG_ASTERISK = /\*\*(?<text>\S(?:[^*]*\S)?)\*\*/gu;
const STRONG_UNDERSCORE = /__(?<text>\S(?:[^_]*\S)?)__/gu;
const STRIKETHROUGH = /~~(?<text>\S(?:[^~]*\S)?)~~/gu;
const EMPHASIS_ASTERISK = /\*(?<text>\S(?:[^*]*\S)?)\*/gu;
// Requires a non-word character before the opening underscore and a
// non-word character after the closing one, so `snake_case` survives intact.
const EMPHASIS_UNDERSCORE =
  /(?<lead>^|[\s(])_(?<text>\S(?:[^_]*\S)?)_(?=$|[\s).,!?:;])/gu;
const WHITESPACE = /\s+/gu;
const TRAILING_NOISE = /[\s.,;:!?—–-]+$/gu;

/** Replaces block syntax with nothing, keeping the inline word text. */
const stripBlockSyntax = (text: string): string =>
  text
    .replaceAll(HEADING, "")
    .replaceAll(BLOCKQUOTE, "")
    .replaceAll(LIST_MARKER, "")
    .replaceAll(HORIZONTAL_RULE, " ")
    .replaceAll(HTML_TAG, " ");

/** Replaces code and emphasis markers, keeping the words they wrapped. */
const stripInlineSyntax = (text: string): string =>
  text
    .replaceAll(FENCED_CODE, " ")
    .replaceAll(INLINE_CODE, "$<code>")
    .replaceAll(IMAGE, "$<alt>")
    .replaceAll(LINK, "$<text>")
    .replaceAll(STRONG_UNDERSCORE, "$<text>")
    .replaceAll(STRONG_ASTERISK, "$<text>")
    .replaceAll(STRIKETHROUGH, "$<text>")
    .replaceAll(EMPHASIS_UNDERSCORE, "$<lead>$<text>")
    .replaceAll(EMPHASIS_ASTERISK, "$<text>");

const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }

  const clipped = text.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");
  const body =
    lastSpace > maxLength * MIN_WORD_BREAK_RATIO
      ? clipped.slice(0, lastSpace)
      : clipped;

  return `${body.replaceAll(TRAILING_NOISE, "")}${ELLIPSIS}`;
};

/**
 * Derives a short plain-text teaser from a Markdown body. Strips syntax rather
 * than rendering it, so the result is safe to render as text.
 *
 * `maxLength` bounds the text itself; the trailing ellipsis is a marker and is
 * appended on top, so the returned string may be one character longer.
 */
export const toPreview = (
  markdown: string,
  maxLength: number = PREVIEW_MAX_LENGTH
): string => {
  const text = stripBlockSyntax(stripInlineSyntax(markdown))
    .replaceAll(WHITESPACE, " ")
    .trim();

  return truncate(text, maxLength);
};

/** Resolves the teaser shown on a card: a manual excerpt wins over the body. */
export const resolvePreview = (post: {
  content: string;
  excerpt: string | null;
}): string => post.excerpt?.trim() || toPreview(post.content);
