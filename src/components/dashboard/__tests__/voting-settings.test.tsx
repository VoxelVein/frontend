import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
/* oxlint-disable anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Server functions are network boundaries; render the real settings form. */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VotingSettings } from "@/components/dashboard/voting-settings";

const mocks = vi.hoisted(() => ({
  config: vi.fn<() => Promise<object>>(),
  stats: vi.fn<() => Promise<object>>(),
  history: vi.fn<() => Promise<object>>(),
  save: vi.fn<() => Promise<object>>(),
  test: vi.fn<() => Promise<object>>(),
}));

vi.mock("@/lib/server-voting.functions", () => ({
  getVoteConfig: mocks.config,
  voteStats: mocks.stats,
  voteHistory: mocks.history,
  saveVoteConfig: mocks.save,
  testVoteConnection: mocks.test,
}));

const mount = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <VotingSettings projectId="server" />
    </QueryClientProvider>
  );

describe("voting settings", () => {
  beforeEach(() => {
    mocks.config.mockResolvedValue({
      votingEnabled: false,
      host: "",
      port: 8192,
      protocol: "v2",
      serviceName: "VoxelVein",
      publicKey: "",
      hasToken: false,
    });
    mocks.stats.mockResolvedValue([]);
    mocks.history.mockResolvedValue([]);
  });

  it("uses a checkbox for the enable toggle", async () => {
    mount();

    const toggle = await screen.findByRole("checkbox", {
      name: "Enable voting",
    });

    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
  });

  it("switches to the RSA key field when v1 is chosen", async () => {
    mount();

    fireEvent.click(await screen.findByRole("combobox", { name: "Protocol" }));

    const v1 = await screen.findByRole("option", {
      name: "Votifier v1 (RSA)",
    });

    fireEvent.pointerDown(v1, { pointerType: "mouse" });
    fireEvent.click(v1);

    await expect(
      screen.findByRole("textbox", { name: "RSA public key" })
    ).resolves.toBeInTheDocument();
    expect(screen.queryByLabelText("NuVotifier token")).toBeNull();
  });
});
