import { IconTrophy } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import { voteCooldown } from "@/lib/server-voting.functions";

interface ServerVoteCountProps {
  projectId: string;
}

/**
 * Vote total in the same compact shape as the online-player count on server
 * cards. The full vote card lives on the detail page; a browse card only needs
 * the number, so it never nests a second card inside itself.
 */
export const ServerVoteCount = ({ projectId }: ServerVoteCountProps) => {
  const { data, isPending } = useQuery({
    queryKey: ["server-vote", projectId],
    queryFn: () => voteCooldown({ data: { projectId } }),
    refetchInterval: 30_000,
    retry: false,
  });

  const total = data?.totalVotes;

  const label =
    total === undefined
      ? "Vote count unavailable"
      : `${total.toLocaleString("en-GB")} votes`;

  let count = "—";

  if (isPending && total === undefined) {
    count = "…";
  } else if (total !== undefined) {
    count = total.toLocaleString("en-GB");
  }

  return (
    <span
      aria-label={label}
      className="text-muted-foreground inline-flex min-w-14 items-center gap-1.5 font-medium tabular-nums"
      title={label}
    >
      <IconTrophy
        aria-hidden="true"
        className={data?.enabled ? "text-primary" : "text-muted-foreground/70"}
        size={14}
      />
      {count}
    </span>
  );
};
