import { Markdown } from "@tanstack/markdown/react";
import type { ComponentProps, ReactNode } from "react";

/**
 * Markdown rendered the way this site's authoring tools imply it.
 *
 * A single Enter should produce the line break the author pressed it for.
 *
 * Standard Markdown says otherwise: one newline is a *soft* break, and HTML
 * collapses it to a space, so a newline the author typed silently disappears.
 * Two trailing spaces make a hard break, but `@tanstack/markdown` does not
 * implement that form — it emits the same soft break for both (verified, not
 * assumed), and raw `<br>` is escaped because `allowHtml` is off. A trailing
 * backslash does work, but requiring authors to type a hidden character to get
 * a visible line is not a reasonable authoring contract.
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
 * Every Markdown surface goes through this, so the four places that render
 * author-written content cannot disagree about what a newline means.
 */
const MarkdownBody = ({ children }: MarkdownBodyProps): ReactNode => (
  <Markdown components={{ p: Paragraph }}>{children}</Markdown>
);

export { MarkdownBody };
