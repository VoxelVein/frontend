import { IconClock, IconTrophy } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { TurnstileWidget } from "@/components/turnstile-widget";
import type { TurnstileWidgetHandle } from "@/components/turnstile-widget";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToastError } from "@/hooks/use-toast-error";
import { authClient } from "@/lib/auth-client";
import {
  formatCooldownRemaining,
  MINECRAFT_EDITIONS,
  MINECRAFT_EDITION_LABELS,
  shouldShowVotingCard,
  voteButtonLabel,
} from "@/lib/server-voting";
import type { MinecraftEdition } from "@/lib/server-voting";
import { castVote, voteCooldown } from "@/lib/server-voting.functions";

const VOTE_QUERY_KEY = "server-vote";

const EDITION_ITEMS = MINECRAFT_EDITIONS.map((value) => ({
  value,
  label: MINECRAFT_EDITION_LABELS[value],
}));

interface ServerVoteButtonProps {
  projectId: string;
  /** Compact version for dense list cards: just the trigger, no count panel. */
  compact?: boolean;
}

// oxlint-disable-next-line complexity -- The compact and full variants share one vote flow.
export const ServerVoteButton = ({
  projectId,
  compact = false,
}: ServerVoteButtonProps) => {
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

  useToastError(
    status.isError ? status.error.message : null,
    `server-vote-status-${projectId}`
  );

  if (status.isPending) {
    if (compact) {
      return <Skeleton className="h-9 w-24" aria-label="Loading vote status" />;
    }

    return (
      <Card size="sm" aria-busy="true" aria-label="Loading voting status">
        <CardContent className="grid gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (status.isError) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          status.refetch();
        }}
      >
        Retry voting status
      </Button>
    );
  }

  // The full card is only for servers that finished setting voting up. The
  // compact counter stays on list cards so the row does not change shape.
  if (!compact && !shouldShowVotingCard(status.data)) {
    return null;
  }

  const label = voteButtonLabel(status.data, remaining);

  const headingId = `server-voting-${projectId}`;

  let dialogContent: ReactNode;

  if (session?.user.emailVerified) {
    dialogContent = (
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor={`vote-edition-${projectId}`}>Minecraft edition</Label>
          <Select
            items={EDITION_ITEMS}
            value={edition}
            onValueChange={(value) => {
              if (value === "java" || value === "bedrock") {
                setEdition(value);
              }
            }}
          >
            <SelectTrigger
              id={`vote-edition-${projectId}`}
              className="min-h-11 w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EDITION_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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

        <TurnstileWidget ref={widget} action="vote" onTokenChange={setToken} />

        <Button
          type="submit"
          size="lg"
          className="min-h-11"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Recording vote…" : "Confirm vote"}
        </Button>
      </form>
    );
  } else if (session) {
    dialogContent = (
      <Alert>
        <AlertTitle>Verify your email</AlertTitle>
        <AlertDescription>
          Verify your email address before you vote.
        </AlertDescription>
      </Alert>
    );
  } else {
    dialogContent = (
      <div className="grid gap-3">
        <p>Sign in with a verified email to vote.</p>
        <Button render={<a aria-label="Sign in to vote" href="/login" />}>
          Sign in to vote
        </Button>
      </div>
    );
  }

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size={compact ? "default" : "lg"}
            className={compact ? "min-h-10" : "min-h-11 w-full"}
            disabled={!shouldShowVotingCard(status.data) || !!remaining}
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

        {dialogContent}
      </DialogContent>
    </Dialog>
  );

  if (compact) {
    return dialog;
  }

  return (
    <Card size="sm" aria-labelledby={headingId}>
      <CardHeader>
        <CardTitle id={headingId} className="flex items-center gap-2">
          <IconTrophy size={16} aria-hidden="true" />
          Server voting
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <p
              aria-live="polite"
              className="text-2xl leading-none font-semibold tabular-nums"
            >
              {status.data.totalVotes.toLocaleString()} votes
            </p>
            <p className="text-muted-foreground text-xs">
              One vote per server every 24 hours
            </p>
          </div>
          {remaining ? (
            <Badge variant="secondary">
              <IconClock aria-hidden="true" />
              {remaining}
            </Badge>
          ) : null}
        </div>

        {dialog}
      </CardContent>
    </Card>
  );
};
