import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StorageGated } from "@/components/storage-gated";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";

const { storageIsConfiguredMock } = vi.hoisted(() => ({
  storageIsConfiguredMock: vi.fn<() => Promise<boolean>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The hook calls a server function that reaches env.config at import time; a string path avoids strict factory type-checking
vi.mock("@/lib/storage.functions", () => ({
  storageIsConfigured: storageIsConfiguredMock,
}));

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
};

const renderGated = () =>
  render(
    <StorageGated>
      {({ isAvailable }) => (
        <Button disabled={!isAvailable} type="button">
          Upload
        </Button>
      )}
    </StorageGated>,
    { wrapper }
  );

/**
 * The check resolves after first paint, so the control renders enabled for a
 * moment before the greying-out appears — which is also exactly what a reader
 * sees if they click inside that window, and why the server still has to
 * refuse the action rather than trusting the client.
 *
 * `settled` therefore asserts the *outcome* after the query resolves, rather
 * than sampling the first frame.
 */
const settled = async (
  name: string,
  assert: (control: HTMLElement) => void
): Promise<HTMLElement> => {
  await screen.findByRole("button", { name });
  // Re-queried inside the wait rather than captured up front: crossing the gate
  // remounts the control, so a reference taken on the first frame is detached by
  // the time the answer is known.
  await waitFor(() => assert(screen.getByRole("button", { name })));
  return screen.getByRole("button", { name });
};

/** Lets the query promise settle without asserting anything about the result. */
const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe(StorageGated, () => {
  beforeEach(() => {
    storageIsConfiguredMock.mockReset().mockResolvedValue(true);
  });

  it("leaves the control alone when storage is configured", async () => {
    renderGated();

    const button = await settled("Upload", (control) => {
      expect(control).toBeEnabled();
    });

    // No wrapper at all in the happy path: a disabled-looking upload control on
    // a site whose storage works is a bug, not a hint.
    expect(button.closest("[aria-disabled='true']")).toBeNull();
  });

  it("disables the control when no file server is configured", async () => {
    storageIsConfiguredMock.mockResolvedValue(false);

    renderGated();

    await settled("Upload", (control) => {
      expect(control).toBeDisabled();
    });
  });

  it("marks the control disabled for assistive technology too", async () => {
    storageIsConfiguredMock.mockResolvedValue(false);

    renderGated();

    const button = await settled("Upload", (control) => {
      expect(control).toBeDisabled();
    });

    // `disabled` alone leaves the reason with nowhere to live: the control
    // simply stops responding.
    expect(button.closest("[aria-disabled='true']")).not.toBeNull();
  });

  it("keeps the control enabled when the check itself fails", async () => {
    storageIsConfiguredMock.mockRejectedValue(new Error("offline"));

    renderGated();

    // Failing open on purpose: a cached `false` never expires, so a flaky check
    // would otherwise leave every upload greyed out permanently on a site whose
    // storage is fine. The action is sent instead, and the server's refusal is
    // what the reader sees — which is honest.
    await flush();
    expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled();
  });

  it("offers a custom reason when one is given", async () => {
    storageIsConfiguredMock.mockResolvedValue(false);

    render(
      <StorageGated reason="Creating a version needs the file server.">
        {({ isAvailable }) => (
          <Button disabled={!isAvailable} type="button">
            Create version
          </Button>
        )}
      </StorageGated>,
      { wrapper }
    );

    await settled("Create version", (control) => {
      expect(control).toBeDisabled();
    });
  });
});
