import { describe, expect, it } from "vitest";

import { resolvePreview, toPreview } from "@/lib/posts";

describe(toPreview, () => {
  it("returns plain paragraphs unchanged", () => {
    expect(toPreview("A short intro to the post.")).toBe(
      "A short intro to the post."
    );
  });

  it("strips ATX heading markers", () => {
    expect(toPreview("## Installation\n\nRun the script.")).toBe(
      "Installation Run the script."
    );
  });

  it("strips fenced code blocks entirely", () => {
    const markdown = [
      "Install with:",
      "",
      "```bash",
      "pnpm install && pnpm dev",
      "```",
      "",
      "Then open the dashboard.",
    ].join("\n");

    expect(toPreview(markdown)).toBe("Install with: Then open the dashboard.");
  });

  it("strips inline code backticks but keeps the code text", () => {
    expect(toPreview("Run `pnpm dev:all` to start both servers.")).toBe(
      "Run pnpm dev:all to start both servers."
    );
  });

  it("keeps link text and drops the URL", () => {
    expect(
      toPreview("See the [deployment guide](https://example.com/a).")
    ).toBe("See the deployment guide.");
  });

  it("drops images but keeps their alt text", () => {
    expect(toPreview("Look: ![dashboard preview](/img/shot.png) here.")).toBe(
      "Look: dashboard preview here."
    );
  });

  it("strips bold, italic, and strikethrough markers", () => {
    expect(toPreview("This is **bold**, _italic_, and ~~gone~~.")).toBe(
      "This is bold, italic, and gone."
    );
  });

  it("preserves intra-word underscores", () => {
    expect(
      toPreview("Call the helper `WEBHOOK_SECRET` in snake_case style.")
    ).toBe("Call the helper WEBHOOK_SECRET in snake_case style.");
  });

  it("strips unordered and ordered list markers", () => {
    const markdown = "- First item\n- Second item\n\n1. Step one\n2. Step two";

    expect(toPreview(markdown)).toBe(
      "First item Second item Step one Step two"
    );
  });

  it("strips blockquote markers", () => {
    expect(toPreview("> Heads up: this is a beta.")).toBe(
      "Heads up: this is a beta."
    );
  });

  it("strips horizontal rules", () => {
    expect(toPreview("Before\n\n---\n\nAfter")).toBe("Before After");
  });

  it("strips inline HTML tags", () => {
    expect(toPreview('<span class="x">Wrapped</span> text')).toBe(
      "Wrapped text"
    );
  });

  it("collapses runs of whitespace into single spaces", () => {
    expect(toPreview("One\n\n\nTwo   \t three")).toBe("One Two three");
  });

  it("truncates long text and appends an ellipsis", () => {
    const result = toPreview("word ".repeat(200), 40);

    expect(result.endsWith("…")).toBeTruthy();
    // 39 characters of text plus the ellipsis marker.
    expect(result).toHaveLength(40);
  });

  it("truncates on a word boundary when one is close to the limit", () => {
    const result = toPreview("alpha beta gamma delta epsilon", 20);

    expect(result).toBe("alpha beta gamma…");
  });

  it("keeps a long unbroken token rather than collapsing to nothing", () => {
    const result = toPreview("x".repeat(300), 20);

    expect(result).toBe(`${"x".repeat(20)}…`);
  });

  it("does not append an ellipsis when text fits the limit", () => {
    expect(toPreview("Exactly ten", 11)).toBe("Exactly ten");
  });

  it("handles a custom max length", () => {
    expect(toPreview("alpha beta gamma", 10)).toBe("alpha beta…");
  });

  it("returns an empty string for empty input", () => {
    expect(toPreview("")).toBe("");
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(toPreview("   \n\n\t  ")).toBe("");
  });

  it("returns an empty string for a code-only body", () => {
    expect(toPreview("```\nconst a = 1;\n```")).toBe("");
  });

  it("strips a leading heading so the teaser starts with real prose", () => {
    expect(toPreview("# Release Notes\n\nWe shipped v2 today.")).toBe(
      "Release Notes We shipped v2 today."
    );
  });

  it("handles non-ASCII prose without mangling it", () => {
    expect(toPreview("Café au lait — naïve résumé ✅")).toBe(
      "Café au lait — naïve résumé ✅"
    );
  });
});

describe(resolvePreview, () => {
  it("prefers a manual excerpt over the body", () => {
    expect(
      resolvePreview({
        content: "The body says something else entirely.",
        excerpt: "A hand-written teaser.",
      })
    ).toBe("A hand-written teaser.");
  });

  it("trims a manual excerpt", () => {
    expect(
      resolvePreview({ content: "Body text here.", excerpt: "  Padded.  " })
    ).toBe("Padded.");
  });

  it("falls back to the body when the excerpt is null", () => {
    expect(
      resolvePreview({ content: "## Title\n\nDerived teaser.", excerpt: null })
    ).toBe("Title Derived teaser.");
  });

  it("falls back to the body when the excerpt is only whitespace", () => {
    expect(resolvePreview({ content: "Derived teaser.", excerpt: "   " })).toBe(
      "Derived teaser."
    );
  });
});
