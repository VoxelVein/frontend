import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownBody } from "@/components/markdown-body";

/** The scheme these tests assert is neutralised, spelled the way a browser reads it. */
// oxlint-disable-next-line no-script-url -- Adversarial fixture: the point of the test is that a browser parses this exact spelling as a script URL and the URL filter rejects it. Rewriting the literal would defeat what is being verified.
const SCRIPT_SCHEME = "javascript:";

/** Renders a post body and hands back the container to inspect. */
const renderMarkdown = (markdown: string): HTMLElement => {
  const { container } = render(<MarkdownBody>{markdown}</MarkdownBody>);

  return container;
};

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

/**
 * The unit tests in `sanitize.test.ts` pin the URL filter and the parsed tree.
 * These pin the thing that actually matters: what the browser ends up holding
 * after the renderer writes author content to the DOM.
 *
 * Assertions are made against the rendered DOM rather than against HTML
 * *strings*, because a string can satisfy a "no <script" check while still
 * yielding a live element once the parser gets hold of it. Asking the DOM what
 * it actually built cannot be fooled that way.
 */
describe(`${MarkdownBody.name} XSS boundary`, () => {
  it("never puts a script element in the document", () => {
    const container = renderMarkdown(
      "Block <script>alert(1)</script> and inline <script>alert(2)</script>"
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container).toHaveTextContent("<script>alert(1)</script>");
  });

  it("never puts an element that loads a foreign document in the document", () => {
    const container = renderMarkdown(
      '<iframe src="https://evil.example"></iframe><object data="/x"></object><embed src="/x"><style>body{display:none}</style><link rel="stylesheet" href="/x.css">'
    );

    for (const tag of ["iframe", "object", "embed", "style", "link"]) {
      expect(container.querySelector(tag)).toBeNull();
    }
  });

  it("leaves no event-handler attribute on any element", () => {
    const container = renderMarkdown(
      '<div onclick="steal()"><p onmouseover="steal()">hover</p><img src="/a.png" alt="a" onerror="steal()"></div>'
    );

    const handlers: string[] = [];

    for (const element of container.querySelectorAll("*")) {
      for (const attribute of element.attributes) {
        if (attribute.name.startsWith("on")) {
          handlers.push(`${element.tagName}@${attribute.name}`);
        }
      }
    }

    expect(handlers).toStrictEqual([]);
  });

  it("leaves no javascript: destination on any Markdown link", () => {
    const container = renderMarkdown("[bad](javascript:alert(1))");

    const destinations = [...container.querySelectorAll("a")].map((anchor) =>
      anchor.getAttribute("href")
    );

    expect(
      destinations.some((href) => href?.toLowerCase().includes(SCRIPT_SCHEME))
    ).toBeFalsy();
  });

  it("shows a blocked payload's text instead of dropping the author's words", () => {
    // Escaping a tag keeps the sentence around it. The payload body survives as
    // escaped text, which is inert.
    const container = renderMarkdown(
      "Callout: <script>alert(1)</script> done."
    );

    expect(container).toHaveTextContent("Callout:");
    expect(container).toHaveTextContent("done.");
    expect(container.querySelector("script")).toBeNull();
  });

  it("shows a code fence's contents verbatim, including markup", () => {
    const container = renderMarkdown("```\n<script>alert(1)</script>\n```");

    expect(container.querySelector("code")?.textContent).toContain(
      "<script>alert(1)</script>"
    );
    expect(container.querySelector("script")).toBeNull();
  });

  it("keeps ordinary Markdown links, emphasis and table semantics", () => {
    const container = renderMarkdown(
      "[Docs](https://example.com/docs) **bold** *italic*\n\n| A | B |\n| - | - |\n| c | d |"
    );

    expect(
      container.querySelector('a[href="https://example.com/docs"]')
    ).toHaveTextContent("Docs");
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelector("em")).toHaveTextContent("italic");
    expect(container.querySelector("td")).toHaveTextContent("c");
  });

  it("keeps the images a post is actually made of, internal and external", () => {
    // The other half of the contract. A filter that only ever removed things
    // would pass every test above while breaking the blog.
    const container = renderMarkdown(
      "![Cover](/uploads/cover.png)\n\n![Remote](https://cdn.example.com/a.png)"
    );

    expect(
      container.querySelector('img[src="/uploads/cover.png"]')
    ).toHaveAttribute("alt", "Cover");
    expect(
      container.querySelector('img[src="https://cdn.example.com/a.png"]')
    ).toBeInTheDocument();
  });
});
