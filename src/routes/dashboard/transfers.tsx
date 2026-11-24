import { IconArrowsExchange } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToastError } from "@/hooks/use-toast-error";
import type { ProjectTransferListItem } from "@/lib/project-transfers.functions";
import {
  cancelProjectTransfer,
  listProjectTransfers,
  respondToProjectTransfer,
} from "@/lib/project-transfers.functions";

const TRANSFERS_QUERY_KEY = "project-transfers";

/** Explicit locale and zone keep SSR and the browser rendering identical. */
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const TransferRow = ({
  item,
  direction,
}: {
  item: ProjectTransferListItem;
  direction: "incoming" | "outgoing";
}) => {
  const client = useQueryClient();

  const respond = useMutation({
    mutationFn: (accept: boolean) =>
      respondToProjectTransfer({
        data: { accept, transferId: item.id },
      }),
    onSuccess: (result) => {
      toast.success(
        result.accepted
          ? `${result.projectName} is now yours.`
          : `You declined the transfer of ${result.projectName}.`
      );
      void client.invalidateQueries({ queryKey: [TRANSFERS_QUERY_KEY] });
    },
    onError: (error) => toast.error(error.message),
  });

  const cancel = useMutation({
    mutationFn: () => cancelProjectTransfer({ data: { transferId: item.id } }),
    onSuccess: () => {
      toast.success("Transfer offer withdrawn.");
      void client.invalidateQueries({ queryKey: [TRANSFERS_QUERY_KEY] });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <li>
      <Card size="sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-foreground font-medium">
              {direction === "incoming"
                ? `${item.userName} offered you `
                : `You offered ${item.userName} `}
              <Link
                className="underline-offset-4 hover:underline"
                params={{ projectId: item.projectId }}
                to="/dashboard/projects/$projectId"
              >
                {item.projectName}
              </Link>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Sent {dateFormatter.format(new Date(item.createdAt))} · expires{" "}
              {dateFormatter.format(new Date(item.expiresAt))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {direction === "incoming" ? (
              <>
                <Button
                  disabled={respond.isPending}
                  onClick={() => respond.mutate(true)}
                  size="sm"
                  type="button"
                >
                  Accept
                </Button>
                <Button
                  disabled={respond.isPending}
                  onClick={() => respond.mutate(false)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Decline
                </Button>
              </>
            ) : (
              <Button
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
                size="sm"
                type="button"
                variant="outline"
              >
                Withdraw
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </li>
  );
};

const TransferList = ({
  direction,
  items,
}: {
  direction: "incoming" | "outgoing";
  items: ProjectTransferListItem[];
}) => (
  <div className="grid gap-3">
    <h2 className="text-lg font-semibold">
      {direction === "incoming" ? "Offers for you" : "Your offers"}
    </h2>
    {items.length === 0 ? (
      <EmptyState
        description={
          direction === "incoming"
            ? "When someone transfers a project to you, the offer appears here."
            : "Transfer one of your projects from its Danger Zone tab."
        }
        icon={<IconArrowsExchange aria-hidden size={24} />}
        title={direction === "incoming" ? "No offers" : "No pending offers"}
        variant="inline"
      />
    ) : (
      <ul className="grid gap-3">
        {items.map((item) => (
          <TransferRow direction={direction} item={item} key={item.id} />
        ))}
      </ul>
    )}
  </div>
);

const TransfersPage = () => {
  const query = useQuery({
    queryFn: () => listProjectTransfers(),
    queryKey: [TRANSFERS_QUERY_KEY],
    refetchInterval: 30_000,
  });

  useToastError(
    query.isError ? query.error.message : null,
    "project-transfers-list"
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        description="Review project ownership offers and track the ones you sent. Offers expire after seven days."
        title="Project transfers"
      />

      <div className="mt-8 grid gap-10">
        {query.isPending ? (
          <div aria-busy="true" className="grid gap-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : null}
        {query.isSuccess ? (
          <>
            <TransferList direction="incoming" items={query.data.incoming} />
            <TransferList direction="outgoing" items={query.data.outgoing} />
          </>
        ) : null}
        {query.isSuccess &&
        query.data.incoming.length + query.data.outgoing.length > 0 ? (
          <Badge variant="secondary" className="justify-self-start">
            {query.data.incoming.length} awaiting your decision
          </Badge>
        ) : null}
      </div>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/transfers")({
  component: TransfersPage,
  head: () => ({
    meta: [{ title: "Project transfers | VoxelVein" }],
  }),
});
