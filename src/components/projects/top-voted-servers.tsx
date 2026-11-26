import { IconArrowRight, IconTrophy } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { ServerVoteButton } from "@/components/projects/server-vote-button";
import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToastError } from "@/hooks/use-toast-error";
import { staggerDelay } from "@/lib/reveal-stagger";
import {
  VOTE_TIMEFRAMES,
  VOTE_TIMEFRAME_DESCRIPTIONS,
  VOTE_TIMEFRAME_LABELS,
} from "@/lib/server-voting";
import type { VoteTimeframe } from "@/lib/server-voting";
import { votingLeaderboard } from "@/lib/server-voting.functions";

interface TopVotedServersProps {
  limit?: number;
}

const ServerIcon = ({ imageId }: { imageId: string | null }) => {
  if (!imageId) {
    return null;
  }

  return (
    <img
      alt=""
      className="size-10 rounded-lg object-cover"
      height={40}
      src={`/api/image/${imageId}`}
      width={40}
    />
  );
};

/** A compact count in the same shape as the player count on server cards. */
const VoteCount = ({ total }: { total: number }) => {
  const label = `${total.toLocaleString("en-GB")} votes`;

  return (
    <span
      aria-label={label}
      className="text-muted-foreground inline-flex min-w-14 items-center gap-1.5 font-medium tabular-nums"
      title={label}
    >
      <IconTrophy aria-hidden="true" className="text-primary" size={14} />
      {total.toLocaleString("en-GB")}
    </span>
  );
};

/**
 * The homepage keeps one lead story and a short ranked list rather than a
 * uniform grid: visitors scan for the current favourite first, then decide
 * whether to dig further. The full list stays on the servers browse page.
 */
export const TopVotedServers = ({ limit = 6 }: TopVotedServersProps) => {
  const [timeframe, setTimeframe] = useState<VoteTimeframe>("monthly");

  const query = useQuery({
    queryKey: ["voting-leaderboard", timeframe],
    queryFn: () => votingLeaderboard({ data: { timeframe } }),
    refetchInterval: 30_000,
  });

  const [lead, ...rest] = (query.data ?? []).slice(0, limit);

  useToastError(
    query.isError ? query.error.message : null,
    "top-voted-servers"
  );

  return (
    <section
      aria-labelledby="top-voted-heading"
      className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
      id="voting"
    >
      <Reveal className="mx-auto max-w-7xl" delay={0.1}>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b pb-8">
          <div>
            <h2
              className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl"
              id="top-voted-heading"
            >
              Top Voted Servers
            </h2>
            <p className="text-muted-foreground mt-2 max-w-prose text-sm sm:text-base">
              The servers players back most. Voting is free and resets every 24
              hours.
            </p>
          </div>

          <Button render={<Link to="/p/servers" />} size="lg" variant="ghost">
            All servers
            <IconArrowRight aria-hidden size={16} />
          </Button>
        </div>

        <Tabs
          className="mt-8"
          onValueChange={(value) => {
            const match = VOTE_TIMEFRAMES.find((item) => item === value);

            if (match) {
              setTimeframe(match);
            }
          }}
          value={timeframe}
        >
          <TabsList variant="line">
            {VOTE_TIMEFRAMES.map((value) => (
              <TabsTrigger key={value} value={value}>
                {VOTE_TIMEFRAME_LABELS[value]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-muted-foreground mt-3 text-sm">
          {VOTE_TIMEFRAME_DESCRIPTIONS[timeframe]}
        </p>

        {query.isPending ? (
          <p aria-live="polite" className="mt-10">
            Loading rankings…
          </p>
        ) : null}
        {query.isError ? (
          <Button
            className="mt-10"
            onClick={() => {
              query.refetch();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry loading rankings
          </Button>
        ) : null}
        {query.isSuccess && !lead ? (
          <div className="mt-10">
            <EmptyState
              description="Once a server enables voting, its rankings appear here."
              icon={<IconTrophy aria-hidden size={24} />}
              title="No votes yet"
              variant="inline"
            />
          </div>
        ) : null}

        {lead ? (
          <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <Reveal delay={0.15}>
              <Card className="h-full" size="sm">
                <CardContent className="grid h-full content-start gap-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge>#1</Badge>
                    <ServerIcon imageId={lead.icon} />
                    <Link
                      className="text-foreground text-xl font-semibold tracking-tight underline-offset-4 hover:underline"
                      params={{ slug: lead.slug }}
                      to="/p/servers/$slug"
                    >
                      {lead.name}
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <VoteCount total={lead.totalVotes} />
                    <ServerVoteButton compact projectId={lead.id} />
                  </div>
                </CardContent>
              </Card>
            </Reveal>

            <ol
              aria-label="More voted servers"
              className="grid content-start gap-3"
            >
              {rest.map((server, index) => (
                <li key={server.id}>
                  <Reveal delay={staggerDelay(index + 1)}>
                    <Card size="sm">
                      <CardContent className="grid gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Badge variant="secondary">#{index + 2}</Badge>
                          <ServerIcon imageId={server.icon} />
                          <Link
                            className="text-foreground font-medium underline-offset-4 hover:underline"
                            params={{ slug: server.slug }}
                            to="/p/servers/$slug"
                          >
                            {server.name}
                          </Link>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <VoteCount total={server.totalVotes} />
                          <ServerVoteButton compact projectId={server.id} />
                        </div>
                      </CardContent>
                    </Card>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </Reveal>
    </section>
  );
};
