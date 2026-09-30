import { Markdown } from "@tanstack/markdown/react";

interface MarkdownPreviewProps {
  /**
   * Id of the element naming this region, so a screen reader announces
   * "Preview" when the content is reached.
   */
  labelledBy: string;
  /** How tall the scroll region is, so a long document does not push the form down. */
  maxHeightClassName?: string;
  /** Raw Markdown. Rendered as-is; an empty value shows the empty state. */
  value: string;
}

/**
 * Renders Markdown exactly as the public pages do.
 *
 * Shared by the blog post editor and the project description so both
 * previews stay identical to the published output. If this ever diverges from
 * `markdown-body` usage in the routes, the preview stops being trustworthy.
 */
export const MarkdownPreview = ({
  labelledBy,
  maxHeightClassName = "max-h-72 min-h-32",
  value,
}: MarkdownPreviewProps) => (
  <div
    aria-labelledby={labelledBy}
    className={`border-border bg-background mt-1.5 overflow-y-auto rounded-lg border p-4 ${maxHeightClassName}`}
  >
    {value.trim() ? (
      <div className="markdown-body text-sm">
        <Markdown>{value}</Markdown>
      </div>
    ) : (
      <p className="text-muted-foreground text-sm">Nothing to preview yet.</p>
    )}
  </div>
);
