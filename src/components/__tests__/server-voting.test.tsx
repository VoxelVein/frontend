import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
/* oxlint-disable anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Server functions and auth are network boundaries; exercise the real dialog and query cache. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { ServerVoteButton } from "@/components/projects/server-vote-button";
import type { VoteDeliveryStatus } from "@/lib/server-voting.functions";

interface VotingSession {
  user: { id: string; emailVerified: boolean };
}

interface VotingMocks {
  session: VotingSession | null;
  status: Mock<
    () => Promise<{
      enabled: boolean;
      totalVotes: number;
      nextVoteAt: string | null;
    }>
  >;
  vote: Mock<
    () => Promise<{
      totalVotes: number;
      nextVoteAt: string;
      deliveryStatus: VoteDeliveryStatus;
    }>
  >;
}

const mocks = vi.hoisted((): VotingMocks => ({
  session: null,
  status: vi.fn<
    () => Promise<{
      enabled: boolean;
      totalVotes: number;
      nextVoteAt: string | null;
    }>
  >(),
  vote: vi.fn<
    () => Promise<{
      totalVotes: number;
      nextVoteAt: string;
      deliveryStatus: VoteDeliveryStatus;
    }>
  >(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: mocks.session }) },
}));

vi.mock("@/lib/server-voting.functions", () => ({
  voteCooldown: mocks.status,
  castVote: mocks.vote,
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
      <ServerVoteButton projectId="server" />
    </QueryClientProvider>
  );

describe("server voting flow", () => {
  beforeEach(() => {
    mocks.session = { user: { id: "user", emailVerified: true } };
    mocks.status.mockResolvedValue({
      enabled: true,
      totalVotes: 12,
      nextVoteAt: null,
    });
    mocks.vote.mockReset();
  });

  it("shows disabled voting and totals", async () => {
    mocks.status.mockResolvedValue({
      enabled: false,
      totalVotes: 12,
      nextVoteAt: null,
    });
    mount();
    await expect(
      screen.findByRole("button", { name: "Voting disabled" })
    ).resolves.toBeDisabled();
    expect(screen.getByText("12 votes")).toBeInTheDocument();
  });

  it("shows an active cooldown", async () => {
    mocks.status.mockResolvedValue({
      enabled: true,
      totalVotes: 12,
      nextVoteAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    mount();
    await expect(
      screen.findByRole("button", { name: /Vote again in/u })
    ).resolves.toBeDisabled();
  });

  it("asks signed-out visitors to sign in", async () => {
    mocks.session = null;
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Vote" }));
    await expect(
      screen.findByRole("link", { name: "Sign in to vote" })
    ).resolves.toHaveAttribute("href", "/login");
  });

  it("submits the chosen player and edition and updates the cooldown", async () => {
    mocks.vote.mockResolvedValue({
      totalVotes: 13,
      nextVoteAt: new Date(Date.now() + 86_400_000).toISOString(),
      deliveryStatus: "sent",
    });
    mocks.status
      .mockResolvedValueOnce({
        enabled: true,
        totalVotes: 12,
        nextVoteAt: null,
      })
      .mockResolvedValue({
        enabled: true,
        totalVotes: 13,
        nextVoteAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Vote" }));
    fireEvent.change(await screen.findByLabelText("Minecraft username"), {
      target: { value: ".BedrockUser" },
    });
    fireEvent.click(
      screen.getByRole("combobox", { name: "Minecraft edition" })
    );

    const bedrock = await screen.findByRole("option", {
      name: "Bedrock Edition",
    });

    // Base UI only commits a mouse selection after a pointer down on the item.
    fireEvent.pointerDown(bedrock, { pointerType: "mouse" });
    fireEvent.click(bedrock);
    fireEvent.click(screen.getByRole("button", { name: "Confirm vote" }));
    await waitFor(() =>
      expect(mocks.vote).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: "server",
          minecraftUsername: ".BedrockUser",
          edition: "bedrock",
        }),
      })
    );
    await expect(
      screen.findByRole("button", { name: /Vote again in/u })
    ).resolves.toBeDisabled();
    expect(screen.getByText("13 votes")).toBeInTheDocument();
  });
});
