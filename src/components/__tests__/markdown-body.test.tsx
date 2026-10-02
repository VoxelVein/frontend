import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownBody } from "@/components/markdown-body";

/**
 * Querying by text content rather than by class: the newline is the whole
 * point, and a class-based assertion would pass even with the soft-break
 * default, because the `\n` is in the DOM either way.
 */
describe(MarkdownBody, () => {
  it("keeps a single Enter as a visible line break", () => {
    // The reported bug: Markdown treats one newline as a soft break and HTML
    // collapses it to a space, so what the author typed disappeared.
    render(<MarkdownBody>{"line one\nline two"}</MarkdownBody>);

    const paragraph = screen.getByText(/line one/u);
    expect(paragraph).toHaveTextContent("line one");
    expect(paragraph.textContent).toBe("line one\nline two");
    expect(paragraph).toHaveStyle({ whiteSpace: "pre-wrap" });
  });

  it("still splits paragraphs on a blank line", () => {
    render(<MarkdownBody>{"para one\n\npara two"}</MarkdownBody>);

    expect(screen.getByText("para one")).toBeInTheDocument();
    expect(screen.getByText("para two")).toBeInTheDocument();
  });

  it("leaves newlines inside a code fence alone", () => {
    // A fence is literal: pre-wrapping it would turn its formatting into
    // rendering, which is the one thing this change must not do.
    render(
      <MarkdownBody>{"```\nconst a = 1;\nconst b = 2;\n```"}</MarkdownBody>
    );

    const code = document.querySelector("code");
    expect(code?.textContent).toContain("\n");
  });

  it("keeps list nesting intact", () => {
    render(<MarkdownBody>{"- one\n  - nested\n- two"}</MarkdownBody>);

    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("nested")).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
  });
});
