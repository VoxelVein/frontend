import type { MarkdownDocument } from "@tanstack/markdown";
import { parseMarkdown } from "@tanstack/markdown/parser";
import { Markdown } from "@tanstack/markdown/react";
import type { ComponentProps, ReactNode } from "react";

import { markdownUrlTransform } from "@/lib/sanitize";

/**
 * Markdown rendered the way this site's authoring tools imply it.
 *
 * A single Enter should produce the line break the author pressed it for.
 *
 * Standard Markdown says otherwise: one newline is a *soft* break, and HTML
 * collapses it to a space, so a newline the author typed silently disappears.
 * Two trailing spaces make a hard break, but `@tanstack/markdown` does not
 * implement that form  -  it emits the same soft break for both (verified, not
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
 * Parses author Markdown without enabling raw HTML.
 *
 * That is the whole XSS boundary: `@tanstack/markdown` escapes author tags into
 * text by default, so no `html` or `inlineHtml` node ever reaches the renderer's
 * raw-HTML path. `urlTransform` covers the half a markup sanitizer could not see
 * anyway  -  a Markdown link is not HTML, so `[click](javascript:...)` has to be
 * filtered as it is parsed.
 */
const parseSafeMarkdown = (markdown: string): MarkdownDocument =>
  parseMarkdown(markdown, { urlTransform: markdownUrlTransform });

/**
 * Every Markdown surface goes through this, so the four places that render
 * author-written content cannot disagree about what a newline means  -  or about
 * what counts as safe to render.
 *
 * The document is parsed here and handed to `<Markdown>` as an already-parsed
 * tree, so {@link parseSafeMarkdown} is the single trust boundary. Both the
 * public pages and the admin preview use it, which means there is no second path
 * to get wrong, and older posts are covered just like new ones.
 */
const MarkdownBody = ({ children }: MarkdownBodyProps): ReactNode => (
  <Markdown components={{ p: Paragraph }}>
    {parseSafeMarkdown(children)}
  </Markdown>
);

export { MarkdownBody };
