import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminAccountDeletions } from "@/components/admin/admin-account-deletions";
import type { PendingDeletion } from "@/lib/account-lifecycle";

const { listPendingDeletionsMock, restoreAccountMock } = vi.hoisted(() => ({
  listPendingDeletionsMock: vi.fn<() => Promise<PendingDeletion[]>>(),
  restoreAccountMock:
    vi.fn<(opts: { data: { userId: string } }) => Promise<void>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The component talks to server functions; string paths avoid strict factory type-checking against the server function types
vi.mock("@/lib/admin-accounts.functions", () => ({
  listPendingDeletions: listPendingDeletionsMock,
  restoreAccount: restoreAccountMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Toasts render into a portal outside the component tree; a stub keeps the test on the component
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn<(message: string) => void>(),
    success: vi.fn<(message: string) => void>(),
  },
}));

const ALICE: PendingDeletion = {
  deletionRequestedAt: "2026-09-20T10:00:00.000Z",
  email: "alice@example.com",
  id: "user-alice",
  keptProjects: 1,
  name: "Alice",
  projectsToDelete: 2,
  purgeAt: "2026-10-04T10:00:00.000Z",
  username: "alice",
};

describe(AdminAccountDeletions, () => {
  beforeEach(() => {
    listPendingDeletionsMock.mockReset();
    restoreAccountMock.mockReset().mockResolvedValue();
  });

  it("shows an empty state when no account is scheduled for deletion", async () => {
    listPendingDeletionsMock.mockResolvedValue([]);
    render(<AdminAccountDeletions />);

    await expect(
      screen.findByText("No accounts scheduled for deletion")
    ).resolves.toBeTruthy();
  });

  it("restores an account only after confirmation", async () => {
    listPendingDeletionsMock.mockResolvedValue([ALICE]);
    render(<AdminAccountDeletions />);

    await expect(
      screen.findByRole("rowheader", { name: /Alice/u })
    ).resolves.toBeTruthy();
    expect(screen.getByText("2 to delete")).toBeTruthy();
    expect(screen.getByText("1 kept")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: /Restore account.*Alice/u })
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("cancels the scheduled deletion");
    expect(restoreAccountMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Restore account" }));

    await waitFor(() => {
      expect(restoreAccountMock).toHaveBeenCalledWith({
        data: { userId: "user-alice" },
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("rowheader", { name: /Alice/u })).toBeNull();
    });
  });

  it("keeps the dialog open with an error when restoring fails", async () => {
    listPendingDeletionsMock.mockResolvedValue([ALICE]);
    restoreAccountMock.mockRejectedValue(new Error("Restore failed."));
    render(<AdminAccountDeletions />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Restore account.*Alice/u })
    );
    await screen.findByRole("alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Restore account" }));

    await expect(screen.findByRole("alert")).resolves.toHaveProperty(
      "textContent",
      "Restore failed."
    );
  });
});
