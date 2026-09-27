import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminReviews } from "@/components/admin/admin-reviews";
import type { PendingReview } from "@/lib/project-moderation";

const { approveProjectMock, listPendingReviewsMock, rejectProjectMock } =
  vi.hoisted(() => ({
    approveProjectMock:
      vi.fn<(o: { data: { projectId: string } }) => Promise<void>>(),
    listPendingReviewsMock: vi.fn<() => Promise<PendingReview[]>>(),
    rejectProjectMock:
      vi.fn<
        (o: { data: { projectId: string; reason: string } }) => Promise<void>
      >(),
  }));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The component talks to server functions; string paths avoid strict factory type-checking against the server function types
vi.mock("@/lib/project-moderation.functions", () => ({
  approveProject: approveProjectMock,
  listPendingReviews: listPendingReviewsMock,
  rejectProject: rejectProjectMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Toasts render into a portal outside the component tree; a stub keeps the test on the component
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn<(message: string) => void>(),
    success: vi.fn<(message: string) => void>(),
  },
}));

const SODIUM: PendingReview = {
  category: "optimization",
  description: "A long description an admin would read before deciding.",
  id: "11111111-1111-4111-8111-111111111111",
  name: "Sodium",
  ownerName: "Alice",
  slug: "sodium",
  submittedAt: "2026-09-20T10:00:00.000Z",
  summary: "Makes the game go faster.",
  tags: ["performance"],
  type: "mod",
  versionCount: 3,
};

const onDecided = vi.fn<() => Promise<void>>();

describe(AdminReviews, () => {
  beforeEach(() => {
    approveProjectMock.mockReset().mockResolvedValue();
    listPendingReviewsMock.mockReset().mockResolvedValue([]);
    onDecided.mockReset().mockResolvedValue();
    rejectProjectMock.mockReset().mockResolvedValue();
  });

  it("shows an empty state when nothing is waiting", async () => {
    render(<AdminReviews onDecided={onDecided} />);

    await expect(
      screen.findByText("Nothing waiting for review")
    ).resolves.toBeTruthy();
  });

  it("lists a pending project with its owner and version count", async () => {
    listPendingReviewsMock.mockResolvedValue([SODIUM]);
    render(<AdminReviews onDecided={onDecided} />);

    await expect(screen.findByText("Sodium")).resolves.toBeTruthy();
    expect(screen.getByText(/Makes the game go faster/u)).toBeTruthy();
    expect(screen.getByText(/3 versions/u)).toBeTruthy();
    expect(screen.getByText(/by Alice/u)).toBeTruthy();
  });

  it("publishes only after the approval is confirmed", async () => {
    listPendingReviewsMock.mockResolvedValue([SODIUM]);
    render(<AdminReviews onDecided={onDecided} />);

    const approve = await screen.findByRole("button", { name: "Approve" });
    fireEvent.click(approve);

    // The confirm dialog is open but nothing has been sent yet.
    expect(approveProjectMock).toHaveBeenCalledTimes(0);

    fireEvent.click(
      screen.getByRole("button", { name: "Approve and publish" })
    );

    await waitFor(() => {
      expect(approveProjectMock).toHaveBeenCalledWith({
        data: { projectId: SODIUM.id },
      });
    });
    // The resolved row leaves the queue and the tab badge is refreshed.
    await waitFor(() => {
      expect(screen.queryByText("Sodium")).toBeNull();
    });
    expect(onDecided).toHaveBeenCalledOnce();
  });

  it("refuses to send a project back without a reason", async () => {
    listPendingReviewsMock.mockResolvedValue([SODIUM]);
    render(<AdminReviews onDecided={onDecided} />);

    fireEvent.click(await screen.findByRole("button", { name: "Send back" }));

    const confirm = await screen.findByRole("button", {
      name: "Send back to draft",
    });
    // Disabled while the reason box is empty, and submitting is a no-op even
    // if the click lands.
    expect(confirm.hasAttribute("disabled")).toBeTruthy();
    fireEvent.click(confirm);
    expect(rejectProjectMock).toHaveBeenCalledTimes(0);
  });

  it("sends the trimmed reason and drops the project from the queue", async () => {
    listPendingReviewsMock.mockResolvedValue([SODIUM]);
    render(<AdminReviews onDecided={onDecided} />);

    fireEvent.click(await screen.findByRole("button", { name: "Send back" }));

    fireEvent.change(await screen.findByLabelText("Reason"), {
      target: { value: "  Description mentions a dead API.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send back to draft" }));

    await waitFor(() => {
      expect(rejectProjectMock).toHaveBeenCalledWith({
        data: {
          projectId: SODIUM.id,
          reason: "Description mentions a dead API.",
        },
      });
    });
    await waitFor(() => {
      expect(screen.queryByText("Sodium")).toBeNull();
    });
  });

  it("reports a queue that could not be loaded and can retry", async () => {
    listPendingReviewsMock.mockRejectedValueOnce(new Error("boom"));
    render(<AdminReviews onDecided={onDecided} />);

    // The underlying message wins over the fallback, so the admin sees why it
    // failed rather than a generic sentence.
    await expect(screen.findByText("boom")).resolves.toBeTruthy();

    listPendingReviewsMock.mockResolvedValue([SODIUM]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await expect(screen.findByText("Sodium")).resolves.toBeTruthy();
  });
});
