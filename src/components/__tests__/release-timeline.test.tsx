import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReleaseTimeline } from "@/components/changelog/release-timeline";
import type { ReleaseView } from "@/lib/github-releases";

const release = (
  tag: string,
  body: string,
  overrides: Partial<ReleaseView> = {}
): ReleaseView => ({
  body,
  htmlUrl: `https://github.com/VoxelVein/frontend/releases/tag/${tag}`,
  name: tag,
  publishedAt: "2026-11-26T00:00:00Z",
  tag,
  ...overrides,
});

const feature = release(
  "ALPHA-0.18.0",
  "# ALPHA-0.18.0 (2026-11-26)\n\n### Features\n\n* Star ratings for projects"
);

const fix = release(
  "ALPHA-0.17.0",
  "# ALPHA-0.17.0 (2026-11-24)\n\n### Bug Fixes\n\n* Voting status",
  { publishedAt: "2026-11-24T00:00:00Z" }
);

describe("release timeline", () => {
  it("shows the version, publication date and rendered notes", () => {
    render(<ReleaseTimeline releases={[feature]} />);

    expect(
      screen.getByRole("heading", { name: "ALPHA-0.18.0" })
    ).toBeInTheDocument();
    expect(screen.getByText("Nov 26, 2026")).toHaveAttribute(
      "datetime",
      "2026-11-26T00:00:00Z"
    );
    expect(screen.getByText("Star ratings for projects")).toBeInTheDocument();
    // The generated notes already open with a version heading; showing it
    // again inside the card would duplicate the timeline's own heading.
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("offers an anchor link that jumps to each release", () => {
    render(<ReleaseTimeline releases={[feature, fix]} />);

    expect(screen.getByRole("link", { name: "ALPHA-0.18.0" })).toHaveAttribute(
      "href",
      "#release-alpha-0.18.0"
    );
    expect(document.querySelector("[id='release-alpha-0.17.0']")?.tagName).toBe(
      "LI"
    );
  });

  it("links to the canonical release on GitHub", () => {
    render(<ReleaseTimeline releases={[feature]} />);

    expect(
      screen.getByRole("link", { name: "View ALPHA-0.18.0 on GitHub" })
    ).toHaveAttribute(
      "href",
      "https://github.com/VoxelVein/frontend/releases/tag/ALPHA-0.18.0"
    );
  });

  it("marks the first ALPHA-prefixed release as a milestone", () => {
    render(<ReleaseTimeline releases={[feature, fix]} />);

    expect(
      screen.getByText("First ALPHA-prefixed release")
    ).toBeInTheDocument();
    expect(screen.getAllByText("First ALPHA-prefixed release")).toHaveLength(1);
  });

  it("marks breaking changes on the timeline", () => {
    const breaking = release(
      "ALPHA-1.0.0",
      "### BREAKING CHANGES\n\n* removed the old API"
    );

    render(<ReleaseTimeline releases={[breaking, feature]} />);

    expect(screen.getByText("Breaking changes")).toBeInTheDocument();
  });

  it("marks a major version jump", () => {
    const jump = release("ALPHA-0.15.0", "### Features\n\n* new project types");

    const older = release(
      "ALPHA-0.12.1",
      "### Features\n\n* first tagged alpha"
    );

    render(<ReleaseTimeline releases={[jump, older]} />);

    expect(screen.getByText("Major shift to ALPHA-0.15.0")).toBeInTheDocument();
  });

  it("filters to one category and announces the new count", () => {
    render(<ReleaseTimeline releases={[feature, fix]} />);

    const button = screen.getByRole("button", { name: "Fixes, 1 release" });
    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("heading", { name: "ALPHA-0.18.0" })).toBeNull();
    expect(
      screen.getByRole("heading", { name: "ALPHA-0.17.0" })
    ).toBeInTheDocument();
    expect(screen.getByText("1 release")).toHaveAttribute(
      "aria-live",
      "polite"
    );
  });

  it("shows an empty state and a way back when a filter matches nothing", () => {
    const docsOnly = release(
      "ALPHA-0.10.2",
      "### Documentation\n\n* first guide"
    );

    render(<ReleaseTimeline releases={[docsOnly]} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Features, 0 releases" })
    );

    expect(
      screen.getByText("No releases in this category")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all releases" }));
    expect(
      screen.getByRole("heading", { name: "ALPHA-0.10.2" })
    ).toBeInTheDocument();
  });

  it("shows an empty state when GitHub has no releases", () => {
    render(<ReleaseTimeline releases={[]} />);

    expect(screen.getByText("No releases yet")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Jump to a release" })
    ).toBeNull();
  });
});
