/**
 * Server voting configuration and rules shared by client and server.
 */

export const VOTE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** The public status of one server's voting setup. */
export interface VoteStatusSnapshot {
  /** Voting is on and the project is published. */
  enabled: boolean;
  /** A listener host, port and the credentials for its protocol are saved. */
  configured: boolean;
  nextVoteAt: string | null;
  totalVotes: number;
}

/**
 * Whether a server should show the voting card.
 *
 * Enabling the toggle is only half of the setup: without a listener address
 * and its credentials there is nothing to vote for, so an empty card would
 * advertise a feature the owner has not finished configuring.
 */
export const shouldShowVotingCard = (status: VoteStatusSnapshot): boolean =>
  status.enabled && status.configured;

/** The vote button's label, from the same status rules as the card's presence. */
export const voteButtonLabel = (
  status: VoteStatusSnapshot,
  remaining: string | null
): string => {
  if (!shouldShowVotingCard(status)) {
    return "Voting disabled";
  }

  if (remaining) {
    return `Vote again in ${remaining}`;
  }

  return "Vote";
};

/**
 * Which protocol a server's Votifier listener speaks.
 */
export type VoteProtocol = "v1" | "v2";

export const VOTE_PROTOCOLS: readonly VoteProtocol[] = ["v1", "v2"];

/**
 * A vote timeframe used for leaderboards and statistics.
 */
export type VoteTimeframe = "daily" | "weekly" | "monthly" | "all-time";

export const VOTE_TIMEFRAMES: readonly VoteTimeframe[] = [
  "daily",
  "weekly",
  "monthly",
  "all-time",
];

export const VOTE_TIMEFRAME_LABELS: Record<VoteTimeframe, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  "all-time": "All time",
};

export const VOTE_TIMEFRAME_DESCRIPTIONS: Record<VoteTimeframe, string> = {
  daily: "Servers with the most votes in the last 24 hours.",
  weekly: "Servers with the most votes in the last 7 days.",
  monthly: "Servers with the most votes in the last 30 days.",
  "all-time": "Servers with the most votes ever.",
};

/**
 * How long a given timeframe looks back.
 */
export const timeframeWindowMs = (timeframe: VoteTimeframe): number => {
  switch (timeframe) {
    case "daily": {
      return VOTE_COOLDOWN_MS;
    }

    case "weekly": {
      return 7 * VOTE_COOLDOWN_MS;
    }

    case "monthly": {
      return 30 * VOTE_COOLDOWN_MS;
    }

    case "all-time": {
      return Infinity;
    }

    default: {
      throw new Error("Unknown voting timeframe.");
    }
  }
};

/**
 * Formats a cooldown remaining time into a human-readable phrase.
 * Returns null when the user can vote already.
 */
export const formatCooldownRemaining = (remainingMs: number): string | null => {
  if (remainingMs <= 0) {
    return null;
  }

  const hours = Math.floor(remainingMs / (60 * 60 * 1000));

  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return minutes > 0 ? `${minutes}m` : "less than 1m";
};

/**
 * Minecraft edition a player connects with, used for the Votifier address and
 * reward delivery.
 */
export type MinecraftEdition = "java" | "bedrock";

export const MINECRAFT_EDITIONS: readonly MinecraftEdition[] = [
  "java",
  "bedrock",
];

export const MINECRAFT_EDITION_LABELS: Record<MinecraftEdition, string> = {
  java: "Java Edition",
  bedrock: "Bedrock Edition",
};
