import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { VOTE_TIMEFRAME_LABELS } from "@/lib/server-voting";
import type { VoteProtocol } from "@/lib/server-voting";
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
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Enable voting
        </label>
        <p className="text-muted-foreground text-sm">
          Voting works without rewards. Leave the host empty to disable
          Minecraft notifications.
        </p>
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
        <label className="grid gap-2">
          Protocol
          <select
            value={protocol}
            onChange={(event) =>
              setProtocol(event.target.value === "v1" ? "v1" : "v2")
            }
            className="bg-background border-input rounded-lg border p-3 focus-visible:outline-2"
          >
            <option value="v2">NuVotifier v2 (token)</option>
            <option value="v1">Votifier v1 (RSA)</option>
          </select>
        </label>
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
          <label className="grid gap-2">
            RSA public key
            <textarea
              className="border-input bg-background min-h-28 rounded-lg border p-3 focus-visible:outline-2"
              value={publicKey}
              onChange={(event) => setPublicKey(event.target.value)}
            />
          </label>
        )}
        {save.isError ? <p role="alert">{save.error.message}</p> : null}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save voting settings"}
        </Button>
      </form>
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
        <Button type="submit" variant="outline" disabled={test.isPending}>
          {test.isPending ? "Testing…" : "Send test vote"}
        </Button>
        {test.data ? <output>{test.data.detail}</output> : null}
        {test.isError ? <p role="alert">{test.error.message}</p> : null}
      </form>
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

  return (
    <section
      className="border-border mt-8 grid gap-6 border-t pt-8"
      aria-labelledby="voting-settings-heading"
    >
      <h2 id="voting-settings-heading" className="text-xl font-semibold">
        Server voting
      </h2>
      {config.isPending && <output>Loading voting settings…</output>}
      {config.isError && (
        <p role="alert">
          Could not load settings.{" "}
          <button
            type="button"
            onClick={() => {
              config.refetch();
            }}
          >
            Retry
          </button>
        </p>
      )}
      {config.isSuccess && (
        <VotingSettingsForm projectId={projectId} config={config.data} />
      )}
      <h3 className="font-semibold">Voting statistics</h3>
      {stats.isError && <p role="alert">Could not load statistics.</p>}
      {stats.isPending && <output>Loading statistics…</output>}
      {stats.isSuccess && (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.data.map((stat) => (
            <div key={stat.timeframe}>
              <dt>{VOTE_TIMEFRAME_LABELS[stat.timeframe]}</dt>
              <dd className="text-2xl font-semibold">
                {stat.total.toLocaleString("en-GB")}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <h3 className="font-semibold">Recent votes</h3>
      {history.isError && <p role="alert">Could not load vote history.</p>}
      {history.isPending && <output>Loading history…</output>}
      {history.isSuccess && history.data.length === 0 && <p>No votes yet.</p>}
      {history.isSuccess && history.data.length > 0 && (
        <ul className="grid gap-3">
          {history.data.map((vote) => (
            <li className="border-border rounded-lg border p-3" key={vote.id}>
              <p>
                {vote.minecraftUsername} · {vote.edition} ·{" "}
                {new Date(vote.votedAt).toLocaleString("en-GB", {
                  timeZone: "UTC",
                })}
              </p>
              <p className="text-muted-foreground text-sm">
                {vote.deliveryStatus}:{" "}
                {vote.deliveryDetail ??
                  "Delivery outcome not confirmed. No automatic retry."}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
