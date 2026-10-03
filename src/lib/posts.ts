import {
  array,
  boolean,
  check,
  nonEmpty,
  nullable,
  object,
  optional,
  picklist,
  pipe,
  string,
} from "valibot";

/**
 * The sections a post can be filed under, in the order they are offered.
 *
 * The order is deliberate and is not alphabetical: it runs from what the
 * engineering team writes most through to release notes, so the picker leads
 * with the categories that actually get used. An alphabetical list would put
 * Changelog first, which is the least interesting section on the site.
 *
 * This is the single source for the stored slug, the admin picker, and the
 * breadcrumb, so a category can never be spelled one way in the form and
 * another on the page. Adding one is a change here and nowhere else.
 */
export const POST_CATEGORIES = [
  { label: "Engineering", value: "engineering" },
  { label: "Community", value: "community" },
  { label: "Company News", value: "company-news" },
  { label: "Customers", value: "customers" },
  { label: "Security", value: "security" },
  { label: "Changelog", value: "changelog" },
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number]["value"];

const POST_CATEGORY_VALUES = POST_CATEGORIES.map((category) => category.value);

/**
 * The label a category is shown under.
 *
 * A stored value the registry does not know falls back to the raw slug rather
 * than rendering as blank, so a post written before a category was renamed stays
 * readable instead of silently losing its breadcrumb.
 */
export const postCategoryLabel = (value: string | null): string | null => {
  if (value === null) {
    return null;
  }

  return (
    POST_CATEGORIES.find((category) => category.value === value)?.label ?? value
  );
};

/** One credited author of a post. */
export interface PostAuthor {
  id: string;
  /** Null when the account has no avatar; the UI falls back to initials. */
  image: string | null;
  name: string;
  /** Null when the account never set one, so no profile link is offered. */
  username: string | null;
}

/**
 * A staff account offered in the editor's author picker.
 *
 * A superset of `PostAuthor`, so the picker renders each candidate through the
 * same component the byline uses and cannot drift from it.
 */
export interface SelectableAuthor extends PostAuthor {
  /** Whether this is the account doing the editing. */
  isCurrentUser: boolean;
  role: string;
}

/**
 * The byline as one line of text, e.g. "Hedi Zandi, Ben Sabic, Dima Voytenko".
 *
 * A plain comma join rather than `Intl.ListFormat`, which would insert an
 * Oxford comma and read as a different list.
 */
export const formatAuthorNames = (authors: PostAuthor[]): string =>
  authors.map((author) => author.name).join(", ");

export interface PostSummary {
  authors: PostAuthor[];
  /** Null means uncategorised. See `POST_CATEGORIES`. */
  category: string | null;
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
  content: string;
}

export interface PostInput {
  /** Ordered; index 0 is the primary author. Staff-only, enforced server-side. */
  authorIds: string[];
  category?: PostCategory | null;
  content: string;
  excerpt?: string;
  published: boolean;
  slug: string;
  title: string;
}

export const postTitleSchema = pipe(string(), nonEmpty("Title is required."));

export const postSlugSchema = pipe(
  string(),
  nonEmpty("URL slug is required."),
  check(
    (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value),
    "Use lowercase letters, numbers, and hyphens."
  )
);

export const postContentSchema = pipe(
  string(),
  nonEmpty("Content is required.")
);

export const postCategorySchema = picklist(POST_CATEGORY_VALUES);

export const postInputSchema = object({
  authorIds: array(string()),
  category: optional(nullable(postCategorySchema)),
  content: postContentSchema,
  excerpt: optional(string()),
  published: boolean(),
  slug: postSlugSchema,
  title: postTitleSchema,
});

export const postUpdateSchema = object({
  authorIds: array(string()),
  category: optional(nullable(postCategorySchema)),
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
