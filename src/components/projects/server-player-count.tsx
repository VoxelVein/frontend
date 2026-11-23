import { IconUsers } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import { getMinecraftServerStatuses } from "@/lib/server-status.functions";
import type { MinecraftServerStatus } from "@/lib/server-status.functions";

interface ServerPlayerCountProps {
  managed?: boolean;
  projectId: string;
  status?: MinecraftServerStatus;
}

export const ServerPlayerCount = ({
  managed = false,
  projectId,
  status: providedStatus,
}: ServerPlayerCountProps) => {
  const { data, isPending } = useQuery({
    enabled: !managed && providedStatus === undefined,
    queryFn: async () => {
      const statuses = await getMinecraftServerStatuses({
        data: { projectIds: [projectId] },
      });

      return statuses[projectId];
    },
    queryKey: ["minecraft-server-status", projectId],
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 60_000,
  });

  const status = providedStatus ?? data;

  const playerCount =
    status?.online === true &&
    status.onlinePlayers !== null &&
    status.maxPlayers !== null;

  const countLabel = playerCount
    ? `${status.onlinePlayers}/${status.maxPlayers}`
    : null;

  let label = "Player count unavailable";

  if (isPending && !providedStatus) {
    label = "Checking server status";
  } else if (countLabel) {
    label = `${countLabel} players online`;
  } else if (status?.online === false) {
    label = "Server offline";
  }

  let count = "—";

  if (isPending && !providedStatus) {
    count = "…";
  } else if (countLabel) {
    count = countLabel;
  }

  return (
    <span
      aria-label={label}
      className="text-muted-foreground inline-flex min-w-14 items-center gap-1.5 font-medium tabular-nums"
      title={label}
    >
      <IconUsers
        aria-hidden="true"
        className={status?.online ? "text-primary" : "text-muted-foreground/70"}
        size={14}
      />
      {count}
    </span>
  );
};
