import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { FormTextarea } from "@/components/form-textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
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
import { VOTE_TIMEFRAME_LABELS } from "@/lib/server-voting";
import type { VoteProtocol } from "@/lib/server-voting";
import type { VoteDeliveryStatus } from "@/lib/server-voting.functions";
import {
  getVoteConfig,
  saveVoteConfig,
  testVoteConnection,
  voteHistory,
  voteStats,
} from "@/lib/server-voting.functions";

type ConfigView = Awaited<ReturnType<typeof getVoteConfig>>;

interface VotingSettingsProps {
  projectId: string;
}

const PROTOCOL_ITEMS: readonly {
  label: string;
  value: VoteProtocol;
}[] = [
  { label: "NuVotifier v2 (token)", value: "v2" },
  { label: "Votifier v1 (RSA)", value: "v1" },
];

type DeliveryVariant = "default" | "secondary" | "destructive" | "outline";

/** Vote history comes back as plain text, so unknown statuses fall back. */
const DELIVERY_VARIANTS: ReadonlyMap<string, DeliveryVariant> = new Map<
  VoteDeliveryStatus,
  DeliveryVariant
>([
  ["disabled", "outline"],
  ["failed", "destructive"],
  ["sent", "default"],
  ["unconfirmed", "secondary"],
]);

const VotingSettingsForm = ({
  projectId,
  config,
}: {
  projectId: string;
  config: ConfigView;
}) => {
  const client = useQueryClient();

  const initial = config ?? {
    votingEnabled: false,
    host: "",
    port: 8192,
    protocol: "v2",
    serviceName: "VoxelVein",
    publicKey: "",
    hasToken: false,
  };

  const [enabled, setEnabled] = useState(initial.votingEnabled ?? false);
  const [host, setHost] = useState(initial.host ?? "");
  const [port, setPort] = useState(String(initial.port ?? 8192));

  const [protocol, setProtocol] = useState<VoteProtocol>(
    initial.protocol ?? "v2"
  );

  const [serviceName, setServiceName] = useState(
    initial.serviceName || "VoxelVein"
  );

  const [token, setToken] = useState("");
  const [publicKey, setPublicKey] = useState(initial.publicKey ?? "");
  const [testName, setTestName] = useState("");

  const save = useMutation({
    mutationFn: () =>
      saveVoteConfig({
        data: {
          projectId,
          host,
          protocol,
          serviceName,
          publicKey,
          port: Number(port),
          token: token || undefined,
          votingEnabled: enabled,
        },
      }),
    onSuccess: async () => {
      setToken("");
      toast.success("Voting settings saved");
      await client.invalidateQueries({
        queryKey: ["voting-settings", projectId],
      });
      await client.invalidateQueries({ queryKey: ["server-vote", projectId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const test = useMutation({
    mutationFn: () =>
      testVoteConnection({
        data: { projectId, minecraftUsername: testName, edition: "java" },
      }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(result.detail);
      } else {
        toast.error(result.detail);
      }
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-6">
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="border-border bg-card flex min-h-11 items-center gap-3 rounded-lg border px-3">
          <Checkbox
            id={`voting-enabled-${projectId}`}
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(checked)}
          />
          <Label htmlFor={`voting-enabled-${projectId}`}>Enable voting</Label>
        </div>
        <p className="text-muted-foreground text-sm">
          Voting works without rewards. Leave the host empty to disable
          Minecraft notifications.
        </p>
        {enabled ? null : (
          <p className="text-muted-foreground text-sm">
            Turn on voting to configure a listener or send rewards.
          </p>
        )}

        <div
          aria-disabled={!enabled}
          className={cn(
            "grid gap-4",
            !enabled && "pointer-events-none opacity-50"
          )}
        >
          <Card size="sm">
            <CardHeader>
              <CardTitle>Votifier listener</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <FormField
                id="votifier-host"
                label="Votifier host"
                value={host}
                onChange={(event) => setHost(event.target.value)}
              />
              <FormField
                id="votifier-port"
                label="Votifier port"
                value={port}
                onChange={(event) => setPort(event.target.value)}
                type="number"
                min={1}
                max={65_535}
                required
              />

              <div className="grid gap-2">
                <Label htmlFor="votifier-protocol">Protocol</Label>
                <Select
                  items={PROTOCOL_ITEMS}
                  value={protocol}
                  onValueChange={(value) => {
                    if (value === "v1" || value === "v2") {
                      setProtocol(value);
                    }
                  }}
                >
                  <SelectTrigger
                    id="votifier-protocol"
                    className="min-h-11 w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROTOCOL_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <FormField
                id="votifier-service"
                label="Service name"
                value={serviceName}
                onChange={(event) => setServiceName(event.target.value)}
                required
              />

              {protocol === "v2" ? (
                <FormField
                  id="votifier-token"
                  label="NuVotifier token"
                  type="password"
                  autoComplete="new-password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  helperText={
                    initial.hasToken
                      ? "A token is saved. Leave blank to retain it."
                      : "Stored encrypted and never returned to the browser."
                  }
                />
              ) : (
                <FormTextarea
                  id="votifier-public-key"
                  label="RSA public key"
                  value={publicKey}
                  onChange={(event) => setPublicKey(event.target.value)}
                  rows={4}
                />
              )}

              <Button type="submit" size="lg" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save voting settings"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>

      <div
        aria-disabled={!enabled}
        className={cn(
          "grid gap-2",
          !enabled && "pointer-events-none opacity-50"
        )}
      >
        <Card size="sm">
          <CardHeader>
            <CardTitle>Test reward delivery</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                test.mutate();
              }}
            >
              <FormField
                id="votifier-test-name"
                label="Test player name"
                value={testName}
                onChange={(event) => setTestName(event.target.value)}
                required
                maxLength={16}
                helperText="Uses saved settings. Sends a real reward notification without adding a vote or cooldown."
              />
              <Button
                type="submit"
                size="lg"
                variant="outline"
                disabled={test.isPending}
              >
                {test.isPending ? "Testing…" : "Send test vote"}
              </Button>
              {test.data ? (
                <Alert>
                  <AlertDescription>
                    <output>{test.data.detail}</output>
                  </AlertDescription>
                </Alert>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export const VotingSettings = ({ projectId }: VotingSettingsProps) => {
  const config = useQuery({
    queryKey: ["voting-settings", projectId],
    queryFn: () => getVoteConfig({ data: { projectId } }),
  });

  const stats = useQuery({
    queryKey: ["voting-statistics", projectId],
    queryFn: () => voteStats({ data: { projectId } }),
    refetchInterval: 30_000,
  });

  const history = useQuery({
    queryKey: ["voting-history", projectId],
    queryFn: () => voteHistory({ data: { projectId } }),
    refetchInterval: 30_000,
  });

  useToastError(
    config.isError ? config.error.message : null,
    `voting-config-${projectId}`
  );
  useToastError(
    stats.isError ? stats.error.message : null,
    `voting-stats-${projectId}`
  );
  useToastError(
    history.isError ? history.error.message : null,
    `voting-history-${projectId}`
  );

  return (
    <section
      className="border-border mt-8 grid gap-6 border-t pt-8"
      aria-labelledby="voting-settings-heading"
    >
      <h2 id="voting-settings-heading" className="text-xl font-semibold">
        Server voting
      </h2>

      {config.isPending ? (
        <Card size="sm" aria-busy="true" aria-label="Loading voting settings">
          <CardContent className="grid gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      ) : null}
      {config.isError ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            config.refetch();
          }}
        >
          Retry loading voting settings
        </Button>
      ) : null}
      {config.isSuccess ? (
        <VotingSettingsForm projectId={projectId} config={config.data} />
      ) : null}

      <div className="grid gap-3">
        <h3 className="font-semibold">Voting statistics</h3>
        {stats.isPending ? (
          <Skeleton className="h-20 w-full" aria-label="Loading statistics" />
        ) : null}
        {stats.isSuccess ? (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.data.map((stat) => (
              <div key={stat.timeframe}>
                <Card size="sm">
                  <CardContent className="grid gap-1 text-center">
                    <dt className="text-muted-foreground text-xs">
                      {VOTE_TIMEFRAME_LABELS[stat.timeframe]}
                    </dt>
                    <dd className="text-xl font-semibold tabular-nums">
                      {stat.total.toLocaleString("en-GB")}
                    </dd>
                  </CardContent>
                </Card>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      <div className="grid gap-3">
        <h3 className="font-semibold">Recent votes</h3>
        {history.isPending ? (
          <Skeleton className="h-20 w-full" aria-label="Loading history" />
        ) : null}
        {history.isSuccess && history.data.length === 0 ? (
          <Alert>
            <AlertDescription>No votes yet.</AlertDescription>
          </Alert>
        ) : null}
        {history.isSuccess && history.data.length > 0 ? (
          <ItemGroup>
            {history.data.map((vote) => (
              <Item key={vote.id} variant="outline">
                <ItemContent>
                  <ItemTitle>
                    {vote.minecraftUsername} · {vote.edition}
                  </ItemTitle>
                  <ItemDescription>
                    {new Date(vote.votedAt).toLocaleString("en-GB", {
                      timeZone: "UTC",
                    })}
                  </ItemDescription>
                  <ItemDescription>
                    {vote.deliveryDetail ??
                      "Delivery outcome not confirmed. No automatic retry."}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge
                    variant={
                      DELIVERY_VARIANTS.get(vote.deliveryStatus) ?? "outline"
                    }
                  >
                    {vote.deliveryStatus}
                  </Badge>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        ) : null}
      </div>
    </section>
  );
};
