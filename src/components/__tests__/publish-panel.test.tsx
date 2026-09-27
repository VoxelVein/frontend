import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublishPanel } from "@/components/dashboard/publish-panel";
import type { ProjectView } from "@/lib/projects";

const {
  submitProjectForReviewMock,
  unpublishProjectMock,
  withdrawProjectReviewMock,
} = vi.hoisted(() => ({
  submitProjectForReviewMock: vi.fn<() => Promise<void>>(),
  unpublishProjectMock: vi.fn<() => Promise<void>>(),
  withdrawProjectReviewMock: vi.fn<() => Promise<void>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The panel talks to server functions; string paths avoid strict factory type-checking against the server function types
vi.mock("@/lib/project-moderation.functions", () => ({
  submitProjectForReview: submitProjectForReviewMock,
  unpublishProject: unpublishProjectMock,
  withdrawProjectReview: withdrawProjectReviewMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Links need a router instance; a plain anchor keeps the test on the panel
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Toasts render into a portal outside the component tree; a stub keeps the test on the panel
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn<(message: string) => void>(),
    success: vi.fn<(message: string) => void>(),
  },
}));

const WITH_FILE: ProjectView["versions"] = [
  {
    changelog: "",
    channel: "release",
    createdAt: "2026-09-01T00:00:00.000Z",
    downloads: 0,
    files: [
      {
        filename: "sodium.jar",
        id: "file-1",
        primary: true,
        sha1: "a",
        sha512: "b",
        size: 1,
      },
    ],
    gameVersions: ["1.21"],
    id: "version-1",
    loaders: ["fabric"],
    name: "1.0.0",
    versionNumber: "1.0.0",
  },
];

const project = (overrides: Partial<ProjectView> = {}): ProjectView => ({
  author: "Alice",
  authorUsername: "alice",
  category: "optimization",
  description: "",
  downloads: 0,
  id: "11111111-1111-4111-8111-111111111111",
  isProtected: false,
  name: "Sodium",
  ownerId: "user-alice",
  pendingDeletion: false,
  publishedAt: null,
  rejectionReason: null,
  server: null,
  slug: "sodium",
  status: "draft",
  summary: "Fast.",
  tags: [],
  type: "mod",
  updatedAt: "2026-09-01T00:00:00.000Z",
  versions: WITH_FILE,
  ...overrides,
});

const onChange = vi.fn<() => Promise<void>>();

describe(PublishPanel, () => {
  beforeEach(() => {
    onChange.mockReset().mockResolvedValue();
    submitProjectForReviewMock.mockReset().mockResolvedValue();
    unpublishProjectMock.mockReset().mockResolvedValue();
    withdrawProjectReviewMock.mockReset().mockResolvedValue();
  });

  it("offers review rather than publishing, and never publishes directly", () => {
    render(<PublishPanel onChange={onChange} project={project()} />);

    expect(screen.getByRole("heading", { name: "Draft" })).toBeTruthy();
    const button = screen.getByRole("button", { name: "Submit for review" });
    expect(button).toBeTruthy();
    // The old toggle published on click. There must be no such control.
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
  });

  it("submits for review and reloads", async () => {
    render(<PublishPanel onChange={onChange} project={project()} />);

    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    await waitFor(() => {
      expect(submitProjectForReviewMock).toHaveBeenCalledWith({
        data: { projectId: "11111111-1111-4111-8111-111111111111" },
      });
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("will not submit a project with no uploaded file", () => {
    render(
      <PublishPanel onChange={onChange} project={project({ versions: [] })} />
    );

    expect(
      screen.getByText(/Upload a version with a file before submitting it/u)
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Submit for review" })
    ).toBeNull();
  });

  it("shows the waiting state and offers a way to withdraw", () => {
    render(
      <PublishPanel
        onChange={onChange}
        project={project({ status: "pending" })}
      />
    );

    expect(screen.getByRole("heading", { name: "In review" })).toBeTruthy();
    expect(
      screen.getByText(/stays hidden from the site until they approve it/u)
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Submit for review" })
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Withdraw request" })
    ).toBeTruthy();
  });

  it("surfaces the rejection reason on a draft", () => {
    render(
      <PublishPanel
        onChange={onChange}
        project={project({
          rejectionReason: "Description mentions a dead API.",
        })}
      />
    );

    expect(
      screen.getByRole("heading", { name: "An admin asked for changes" })
    ).toBeTruthy();
    expect(screen.getByText("Description mentions a dead API.")).toBeTruthy();
  });

  it("hides the rejection reason once the project is published", () => {
    render(
      <PublishPanel
        onChange={onChange}
        project={project({
          publishedAt: "2026-09-02T00:00:00.000Z",
          rejectionReason: "Description mentions a dead API.",
          status: "published",
        })}
      />
    );

    expect(screen.getByRole("heading", { name: "Published" })).toBeTruthy();
    expect(screen.queryByText("Description mentions a dead API.")).toBeNull();
  });

  it("unpublishes without going back through review", async () => {
    render(
      <PublishPanel
        onChange={onChange}
        project={project({
          publishedAt: "2026-09-02T00:00:00.000Z",
          status: "published",
        })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));

    await waitFor(() => {
      expect(unpublishProjectMock).toHaveBeenCalledWith({
        data: { projectId: "11111111-1111-4111-8111-111111111111" },
      });
    });
    // Taking something down is the creator's own call, so no submission.
    expect(submitProjectForReviewMock).toHaveBeenCalledTimes(0);
  });

  it("offers no action at all for a removed project", () => {
    render(
      <PublishPanel
        onChange={onChange}
        project={project({ status: "removed" })}
      />
    );

    expect(screen.getByRole("heading", { name: "Removed" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Submit for review" })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Unpublish" })).toBeNull();
  });
});
