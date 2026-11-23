import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SuggestedVersionsModal } from "@/components/dashboard/suggested-versions-modal";

const { getSuggestedVersionsMock } = vi.hoisted(() => ({
  getSuggestedVersionsMock: vi.fn<() => Promise<string[]>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Suggestions come from Mojang over the network; a stub keeps this suite on the editor's behaviour
vi.mock("@/lib/minecraft-versions.functions", () => ({
  getSuggestedMinecraftVersions: getSuggestedVersionsMock,
}));

const renderModal = (
  onAccept: (versions: string[]) => void = vi.fn<
    (versions: string[]) => void
  >(),
  onCancel: () => void = vi.fn<() => void>()
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  render(
    <SuggestedVersionsModal
      initialValues={["1.20.4"]}
      onAccept={onAccept}
      onCancel={onCancel}
    />,
    { wrapper: Wrapper }
  );

  return { onAccept, onCancel };
};

const input = () => screen.getByLabelText("Supported versions");

describe(SuggestedVersionsModal, () => {
  beforeEach(() => {
    getSuggestedVersionsMock.mockReset().mockResolvedValue(["26.3", "1.21.8"]);
  });

  it("pre-populates the editor with suggested versions as removable chips", async () => {
    renderModal();

    await expect(
      screen.findByRole("button", { name: "Remove 26.3" })
    ).resolves.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove 1.21.8" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove 1.20.4" })
    ).toBeInTheDocument();
  });

  it("turns typed text into a chip on Enter and on comma", async () => {
    const onAccept = vi.fn<(versions: string[]) => void>();
    renderModal(onAccept);

    await screen.findByRole("button", { name: "Remove 26.3" });
    fireEvent.change(input(), { target: { value: "1.19.4" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    fireEvent.change(input(), { target: { value: "1.18.2" } });
    fireEvent.keyDown(input(), { key: "," });

    expect(
      screen.getByRole("button", { name: "Remove 1.19.4" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove 1.18.2" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(onAccept).toHaveBeenCalledWith(
      expect.arrayContaining(["1.19.4", "1.18.2", "26.3", "1.20.4"])
    );
  });

  it("turns the last chip back into text on Backspace in an empty field", async () => {
    renderModal();

    await screen.findByRole("button", { name: "Remove 1.21.8" });
    fireEvent.keyDown(input(), { key: "Backspace" });

    expect(input()).toHaveValue("1.21.8");
    expect(screen.queryByRole("button", { name: "Remove 1.21.8" })).toBeNull();

    fireEvent.keyDown(input(), { key: "Enter" });

    expect(input()).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Remove 1.21.8" })
    ).toBeInTheDocument();
  });

  it("removes a chip when its button is pressed", async () => {
    const onAccept = vi.fn<(versions: string[]) => void>();
    renderModal(onAccept);

    fireEvent.click(
      await screen.findByRole("button", { name: "Remove 1.21.8" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(onAccept).toHaveBeenCalledWith(
      expect.not.arrayContaining(["1.21.8"])
    );
  });

  it("asks before discarding and closes only after confirmation", async () => {
    const { onAccept, onCancel } = renderModal();

    await screen.findByRole("button", { name: "Remove 26.3" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await expect(
      screen.findByText("Discard changes?")
    ).resolves.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onAccept).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    await waitFor(() => expect(onCancel).toHaveBeenCalledOnce());
  });

  it("keeps the editor open when discarding is declined", async () => {
    const { onCancel } = renderModal();

    await screen.findByRole("button", { name: "Remove 26.3" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByText("Discard changes?");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByText("Suggested Minecraft versions")
    ).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
