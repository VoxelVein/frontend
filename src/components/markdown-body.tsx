import type { MarkdownDocument } from "@tanstack/markdown";
import { parseMarkdown } from "@tanstack/markdown/parser";
import { Markdown } from "@tanstack/markdown/react";
import type { ComponentProps, ReactNode } from "react";

import { markdownUrlTransform, sanitizeMarkdownDocument } from "@/lib/sanitize";

/**
 * Markdown rendered the way this site's authoring tools imply it.
 *
 * A single Enter should produce the line break the author pressed it for.
 *
 * Standard Markdown says otherwise: one newline is a *soft* break, and HTML
 * collapses it to a space, so a newline the author typed silently disappears.
 * Two trailing spaces make a hard break, but `@tanstack/markdown` does not
 * implement that form — it emits the same soft break for both (verified, not
 * assumed). A trailing backslash does work, but requiring authors to type a
 * hidden character to get a visible line is not a reasonable authoring
 * contract.
 *
 * `pre-wrap` on paragraphs is the fix, and it is deliberately scoped to
 * `p` rather than the whole container:
 *
 * * Code fences and inline code are untouched, so a newline inside a block
 *   still means a newline rather than becoming a break.
 * * Lists and tables are untouched, so nesting and column alignment survive.
 * * Stored Markdown stays CommonMark-clean and portable. Nothing rewrites
 *   the author's text, so what renders here is what renders anywhere else
 *   that parses Markdown properly.
 *
 * The cost is that runs of spaces and any indentation inside a paragraph are
 * now preserved rather than collapsed. That is the intended trade for a
 * creator-facing editor, and it matches what GitHub, Discord, and every
 * modern comment box already do.
 */
const Paragraph = (props: ComponentProps<"p">) => (
  <p {...props} style={{ ...props.style, whiteSpace: "pre-wrap" }} />
);

interface MarkdownBodyProps {
  children: string;
}

/**
 * Parses author Markdown into a tree whose embedded HTML is safe to render.
 *
 * `allowHtml` is set in both places it matters, and they are not the same place:
 * parsing needs it so raw HTML becomes an HTML node rather than literal text, and
 * rendering needs it so that node is emitted instead of being escaped back to
 * text. Omitting it at render time would not fail loudly — it would quietly
 * render every HTML post as visible angle brackets.
 */
const parseSafeMarkdown = (markdown: string): MarkdownDocument =>
  sanitizeMarkdownDocument(
    parseMarkdown(markdown, {
      allowHtml: true,
      urlTransform: markdownUrlTransform,
    })
  );

/**
 * Every Markdown surface goes through this, so the four places that render
 * author-written content cannot disagree about what a newline means — or about
 * what counts as safe to render.
 *
 * The document is parsed and sanitized here and handed to `<Markdown>` as an
 * already-parsed tree, which it renders without re-parsing. That ordering is the
 * security argument: the renderer emits author HTML through
 * `dangerouslySetInnerHTML`, so the HTML has to be clean *before* it gets there,
 * and a tree that is already parsed cannot be re-read as raw text in between.
 *
 * Sanitizing the rendered markup instead would strip the class names on code
 * blocks and the ids the renderer adds for footnote links, so this operates on
 * the author HTML alone and leaves everything the parser produced untouched.
 *
 * `urlTransform` covers the half the sanitizer cannot see: a Markdown link is
 * never an HTML node, so `[click](javascript:alert(1))` never reaches
 * `sanitizeHtml` and has to be filtered as it is parsed.
 *
 * Sanitizing at render time rather than at write time also means posts written
 * before any of this existed are covered, and the admin preview is protected by
 * the same code as the public page — there is no second path to get wrong.
 */
const MarkdownBody = ({ children }: MarkdownBodyProps): ReactNode => (
  <Markdown allowHtml components={{ p: Paragraph }}>
    {parseSafeMarkdown(children)}
  </Markdown>
);

export { MarkdownBody };
