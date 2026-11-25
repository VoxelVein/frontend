import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
/* oxlint-disable anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Server functions and auth are network boundaries; exercise the real form and query cache. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { ProjectReviews } from "@/components/reviews/project-reviews";
import type {
  ReviewListing,
  ReviewStatus,
  ReviewView,
} from "@/lib/project-reviews.functions";

interface ReviewMocks {
  create: Mock<() => Promise<ReviewView>>;
  list: Mock<() => Promise<ReviewListing>>;
  session: { user: { id: string } } | null;
  status: Mock<() => Promise<ReviewStatus>>;
}

const mocks = vi.hoisted((): ReviewMocks => ({
  create: vi.fn<() => Promise<ReviewView>>(),
  list: vi.fn<() => Promise<ReviewListing>>(),
  session: { user: { id: "user" } },
  status: vi.fn<() => Promise<ReviewStatus>>(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: mocks.session }) },
}));

vi.mock("@/lib/project-reviews.functions", () => ({
  createProjectReview: mocks.create,
  listProjectReviews: mocks.list,
  reviewStatus: mocks.status,
}));

const mount = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
          },
        })
      }
    >
      <ProjectReviews projectId="project" />
    </QueryClientProvider>
  );

describe("project reviews", () => {
  beforeEach(() => {
    mocks.session = { user: { id: "user" } };
    mocks.list.mockResolvedValue({
      averageRating: null,
      ratingCount: 0,
      reviews: [],
    });
    mocks.status.mockResolvedValue({
      downloadReadyAt: null,
      eligible: true,
      hasReviewed: false,
      reason: "eligible",
    });
    mocks.create.mockReset();
  });

  it("offers a review to a signed-in server visitor without a download", async () => {
    mount();
    await expect(
      screen.findByRole("radio", { name: "1 star" })
    ).resolves.not.toBeChecked();
    expect(screen.getByRole("button", { name: "Post review" })).toBeDisabled();
  });

  it("asks a visitor to download a project first", async () => {
    mocks.status.mockResolvedValue({
      downloadReadyAt: null,
      eligible: false,
      hasReviewed: false,
      reason: "download-required",
    });
    mount();

    await expect(
      screen.findByText("Download this project before leaving a review.")
    ).resolves.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Post review" })).toBeNull();
  });

  it("offers a sign-in link to a visitor without an account", async () => {
    mocks.session = null;
    mocks.status.mockResolvedValue({
      downloadReadyAt: null,
      eligible: false,
      hasReviewed: false,
      reason: "sign-in",
    });
    mount();

    await expect(
      screen.findByRole("link", { name: "Sign in" })
    ).resolves.toHaveAttribute("href", "/login");
  });

  it("submits the chosen stars and optional comment", async () => {
    mocks.create.mockResolvedValue({
      authorName: "Player",
      comment: "Nice mod",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "review-1",
      rating: 4,
    });
    mount();

    fireEvent.click(await screen.findByRole("radio", { name: "4 stars" }));
    fireEvent.change(await screen.findByLabelText("Comment (optional)"), {
      target: { value: "Nice mod" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Post review" }));

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        data: { comment: "Nice mod", projectId: "project", rating: 4 },
      })
    );
  });

  it("shows saved reviews with their ratings and authors", async () => {
    mocks.list.mockResolvedValue({
      averageRating: 4,
      ratingCount: 1,
      reviews: [
        {
          authorName: "Player",
          comment: "Great server",
          createdAt: "2026-01-01T00:00:00.000Z",
          id: "review-1",
          rating: 4,
        },
      ],
    });
    mocks.status.mockResolvedValue({
      downloadReadyAt: null,
      eligible: false,
      hasReviewed: true,
      reason: "already-reviewed",
    });
    mount();

    await expect(
      screen.findByText("Great server")
    ).resolves.toBeInTheDocument();
    expect(screen.getByText("Player")).toBeInTheDocument();
    // The mean badge and the individual row both expose the same rating.
    expect(screen.getAllByText("4 out of 5 stars")).toHaveLength(2);
    expect(screen.getByText("You reviewed this.")).toBeInTheDocument();
  });
});
