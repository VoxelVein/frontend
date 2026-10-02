import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminStorage } from "@/components/admin/admin-storage";
import type { StorageUsage } from "@/lib/storage-quota";

const { getStorageUsageMock } = vi.hoisted(() => ({
  getStorageUsageMock: vi.fn<() => Promise<StorageUsage>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The panel reads through a server function; a stub keeps the test on the component
vi.mock("@/lib/storage.functions", () => ({
  getStorageUsage: getStorageUsageMock,
}));

const USAGE: StorageUsage = {
  avatarBytes: 20_000_000,
  avatarCount: 40,
  fileBytes: 4_000_000_000,
  fileCount: 12,
  imageBytes: 500_000_000,
  imageCount: 30,
  quotaBytes: 10_000_000_000,
  usedBytes: 4_520_000_000,
};

const renderPanel = () => render(<AdminStorage />);

describe(AdminStorage, () => {
  beforeEach(() => {
    getStorageUsageMock.mockReset().mockResolvedValue(USAGE);
  });

  it("leads with the headline figure rather than burying it in a sentence", async () => {
    renderPanel();

    // The one number an admin came for, at display size. 4.5e9 bytes renders
    // as 4.2 in binary units, which is what formatBytes produces.
    await expect(screen.findByText("4.2 GB")).resolves.toBeInTheDocument();
    // The subtitle and the <progress> fallback both carry it, which is
    // correct: one is read, one is the fallback for a progressbar.
    expect(screen.getAllByText(/45%/u)).toHaveLength(2);
  });

  it("shows the per-kind byte split, not one combined number", async () => {
    renderPanel();

    await screen.findByText("4.2 GB");
    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("Images")).toBeInTheDocument();
    // 4 GB of files against 500 MB of images, each with its own count.
    expect(screen.getByText(/3\.7 GB · 12 files/u)).toBeInTheDocument();
    expect(screen.getByText(/477 MB · 30 images/u)).toBeInTheDocument();
  });

  it("does not say images dominate when files dominate", async () => {
    renderPanel();

    await screen.findByText("4.2 GB");
    expect(screen.queryByText(/images are the larger share/iu)).toBeNull();
  });

  it("flags images as the larger share when they are", async () => {
    getStorageUsageMock.mockResolvedValue({
      ...USAGE,
      fileBytes: 500_000_000,
      imageBytes: 4_000_000_000,
    });
    renderPanel();

    await expect(
      screen.findByText(/images are the larger share/iu)
    ).resolves.toBeInTheDocument();
  });

  it("explains an absent limit instead of showing a bar at zero", async () => {
    getStorageUsageMock.mockResolvedValue({
      ...USAGE,
      quotaBytes: null,
    });
    renderPanel();

    await expect(
      screen.findByText(/no storage limit is set/iu)
    ).resolves.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("warns once the quota is reached", async () => {
    getStorageUsageMock.mockResolvedValue({
      ...USAGE,
      quotaBytes: 4_500_000_000,
      usedBytes: 4_500_000_000,
    });
    renderPanel();

    await expect(
      screen.findByText(/storage is full/iu)
    ).resolves.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("reports a failure and offers a retry", async () => {
    getStorageUsageMock.mockRejectedValue(
      new Error("Could not reach storage.")
    );
    renderPanel();

    await expect(
      screen.findByText("Could not reach storage.")
    ).resolves.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });
});
