import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { TurnstileWidget } from "@/components/turnstile-widget";
import type { TurnstileWidgetHandle } from "@/components/turnstile-widget";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { formatCooldownRemaining } from "@/lib/server-voting";
import type { MinecraftEdition } from "@/lib/server-voting";
import { castVote, voteCooldown } from "@/lib/server-voting.functions";

const VOTE_QUERY_KEY = "server-vote";

interface ServerVoteButtonProps {
  projectId: string;
}

export const ServerVoteButton = ({ projectId }: ServerVoteButtonProps) => {
  const { data: session } = authClient.useSession();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [edition, setEdition] = useState<MinecraftEdition>("java");
  const [token, setToken] = useState<string | null>(null);
  const widget = useRef<TurnstileWidgetHandle>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, []);

  const status = useQuery({
    queryKey: [VOTE_QUERY_KEY, projectId, session?.user.id],
    queryFn: () => voteCooldown({ data: { projectId } }),
    refetchInterval: 30_000,
  });

  const remaining = status.data?.nextVoteAt
    ? formatCooldownRemaining(Date.parse(status.data.nextVoteAt) - now)
    : null;

  const mutation = useMutation({
    mutationFn: () =>
      castVote({
        data: {
          projectId,
          edition,
          minecraftUsername: username,
          token: token ?? undefined,
        },
      }),
    onSuccess: async (result) => {
      if (result.deliveryStatus === "failed") {
        toast.success(
          "Vote counted. The server could not receive its reward notification."
        );
      } else {
        toast.success("Thanks for voting!");
      }

      client.setQueryData([VOTE_QUERY_KEY, projectId, session?.user.id], {
        enabled: true,
        totalVotes: result.totalVotes,
        nextVoteAt: result.nextVoteAt,
      });
      setOpen(false);
      await client.invalidateQueries({ queryKey: [VOTE_QUERY_KEY, projectId] });
      await client.invalidateQueries({ queryKey: ["voting-leaderboard"] });
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => {
      widget.current?.reset();
      setToken(null);
    },
  });

  if (status.isPending) {
    return <output>Loading voting…</output>;
  }

  if (status.isError) {
    // Same stacking as the loaded state, so the button sits above card links.
    return (
      <div className="relative z-20">
        <Button
          variant="outline"
          onClick={() => {
            status.refetch();
          }}
        >
          Retry voting status
        </Button>
      </div>
    );
  }

  let label = "Vote";

  if (!status.data.enabled) {
    label = "Voting disabled";
  } else if (remaining) {
    label = `Vote again in ${remaining}`;
  }

  return (
    <div className="relative z-20 grid gap-2">
      <span aria-live="polite">
        {status.data.totalVotes.toLocaleString()} votes
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button
              variant="outline"
              disabled={!status.data.enabled || !!remaining}
            />
          }
        >
          {label}
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Vote for this server</DialogTitle>
          <DialogDescription>
            One vote every 24 hours per server. Your Minecraft name receives any
            rewards configured by the owner.
          </DialogDescription>
          {session && !session.user.emailVerified && (
            <p>Verify your email before voting.</p>
          )}
          {!session && <a href="/login">Sign in to vote</a>}
          {session?.user.emailVerified && (
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                mutation.mutate();
              }}
            >
              <label className="grid gap-2">
                Minecraft edition
                <select
                  value={edition}
                  onChange={(event) =>
                    setEdition(
                      event.target.value === "bedrock" ? "bedrock" : "java"
                    )
                  }
                  className="border-input bg-background rounded-lg border p-3 focus-visible:outline-2"
                >
                  <option value="java">Java</option>
                  <option value="bedrock">Bedrock</option>
                </select>
              </label>
              <FormField
                id={`vote-name-${projectId}`}
                label="Minecraft username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                maxLength={16}
                required
                helperText={
                  edition === "bedrock"
                    ? "Use the exact name your reward plugin expects, including any Floodgate prefix."
                    : "Use your Java player name."
                }
              />
              <TurnstileWidget
                ref={widget}
                action="vote"
                onTokenChange={setToken}
              />
              {mutation.isError ? (
                <p role="alert">{mutation.error.message}</p>
              ) : null}
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Recording vote…" : "Confirm vote"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
