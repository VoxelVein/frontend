import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ServerVoteButton } from "@/components/projects/server-vote-button";
import {
  VOTE_TIMEFRAMES,
  VOTE_TIMEFRAME_LABELS,
  VOTE_TIMEFRAME_DESCRIPTIONS,
} from "@/lib/server-voting";
import type { VoteTimeframe } from "@/lib/server-voting";
import { votingLeaderboard } from "@/lib/server-voting.functions";

interface VotingLeaderboardProps {
  limit?: number;
}

export const VotingLeaderboard = ({ limit = 50 }: VotingLeaderboardProps) => {
  const [timeframe, setTimeframe] = useState<VoteTimeframe>("monthly");

  const query = useQuery({
    queryKey: ["voting-leaderboard", timeframe],
    queryFn: () => votingLeaderboard({ data: { timeframe } }),
    refetchInterval: 30_000,
  });

  return (
    <section
      className="mx-auto grid max-w-7xl gap-5 px-4 py-12 sm:px-6 lg:px-8"
      aria-labelledby="voting-heading"
    >
      <h2 id="voting-heading" className="text-2xl font-semibold">
        Top Voted Servers
      </h2>
      <label className="grid max-w-xs gap-2">
        Rank by votes
        <select
          className="bg-background border-input rounded-lg border p-3 focus-visible:outline-2"
          value={timeframe}
          onChange={(event) => {
            const value = VOTE_TIMEFRAMES.find(
              (item) => item === event.target.value
            );

            if (value) {
              setTimeframe(value);
            }
          }}
        >
          {VOTE_TIMEFRAMES.map((value) => (
            <option key={value} value={value}>
              {VOTE_TIMEFRAME_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <p className="text-muted-foreground">
        {VOTE_TIMEFRAME_DESCRIPTIONS[timeframe]}
      </p>
      {query.isPending && <output>Loading rankings…</output>}
      {query.isError && (
        <p role="alert">
          Could not load rankings.{" "}
          <button
            type="button"
            onClick={() => {
              query.refetch();
            }}
          >
            Retry
          </button>
        </p>
      )}
      {query.isSuccess && query.data.length === 0 && (
        <p>No servers have enabled voting yet.</p>
      )}
      {query.isSuccess && query.data.length > 0 && (
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.slice(0, limit).map((server, index) => (
            <li
              key={server.id}
              className="border-border bg-card grid gap-3 rounded-xl border p-5"
            >
              <div className="flex items-center gap-3">
                <span>#{index + 1}</span>
                {server.icon ? (
                  <img
                    src={`/api/image/${server.icon}`}
                    width={40}
                    height={40}
                    alt=""
                  />
                ) : null}
                <a
                  className="font-semibold underline-offset-4 hover:underline"
                  href={`/servers/${server.slug}`}
                >
                  {server.name}
                </a>
              </div>
              <p>
                {server.totalVotes.toLocaleString("en-GB")}{" "}
                {VOTE_TIMEFRAME_LABELS[timeframe].toLowerCase()} votes
              </p>
              <ServerVoteButton projectId={server.id} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
