import {
  IconArrowsExchange,
  IconChecks,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/error-state";
import { PageHeader } from "@/components/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type Direction = "incoming" | "outgoing";

type BulkAction = "accept" | "deny";

interface TransferRowProps {
  direction: Direction;
  isMutating: boolean;
  item: ProjectTransferListItem;
  onCancel: (id: string) => void;
  onRespond: (id: string, accept: boolean) => void;
}

const TransferRow = ({
  direction,
  isMutating,
  item,
  onCancel,
  onRespond,
}: TransferRowProps) => (
  <div className="border-border/60 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b py-4 last:border-b-0">
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
        <IconArrowsExchange size={17} stroke={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm leading-6">
          {direction === "incoming" ? (
            <>
              <span className="text-foreground font-medium">
                {item.userName}
              </span>{" "}
              <span className="text-muted-foreground">offered you</span>
            </>
          ) : (
            <>
              <span className="text-muted-foreground">You offered</span>{" "}
              <span className="text-foreground font-medium">
                {item.userName}
              </span>
            </>
          )}{" "}
          <Link
            className="text-foreground underline-offset-4 hover:underline"
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
    </div>

    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {direction === "incoming" ? (
        <>
          <Button
            disabled={isMutating}
            onClick={() => onRespond(item.id, true)}
            size="sm"
            type="button"
          >
            <IconChecks size={16} aria-hidden="true" />
            Accept
          </Button>
          <Button
            disabled={isMutating}
            onClick={() => onRespond(item.id, false)}
            size="sm"
            type="button"
            variant="outline"
          >
            Deny
          </Button>
        </>
      ) : (
        <Button
          disabled={isMutating}
          onClick={() => onCancel(item.id)}
          size="sm"
          type="button"
          variant="outline"
        >
          Withdraw
        </Button>
      )}
    </div>
  </div>
);

const EmptyTransfers = ({ direction }: { direction: Direction }) => (
  <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
    <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
      <IconArrowsExchange size={22} aria-hidden="true" />
    </span>
    <p className="text-foreground font-medium">
      {direction === "incoming" ? "No offers for you" : "No pending offers"}
    </p>
    <p className="text-muted-foreground max-w-sm text-sm">
      {direction === "incoming"
        ? "When someone transfers a project to you, the offer appears here."
        : "Transfer one of your projects from its Danger Zone tab."}
    </p>
  </div>
);

interface ConfirmBulkProps {
  action: BulkAction | null;
  count: number;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ConfirmBulk = ({
  action,
  count,
  isPending,
  onClose,
  onConfirm,
}: ConfirmBulkProps) => {
  const accepting = action === "accept";

  return (
    <AlertDialog
      open={action !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {accepting ? "Accept every offer?" : "Deny every offer?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {accepting
              ? `You are about to take ownership of ${count} project${count === 1 ? "" : "s"}. This cannot be undone from here.`
              : `All ${count} pending offer${count === 1 ? "" : "s"} will be declined. The owners keep their projects.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={onConfirm}
            variant={accepting ? "default" : "destructive"}
          >
            {accepting ? "Accept all" : "Deny all"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

interface TransferToolbarProps {
  direction: Direction;
  incomingCount: number;
  isMutating: boolean;
  onChange: (direction: Direction) => void;
  onSearchChange: (value: string) => void;
  outgoingCount: number;
  search: string;
}

const TransferToolbar = ({
  direction,
  incomingCount,
  isMutating,
  onChange,
  onSearchChange,
  outgoingCount,
  search,
}: TransferToolbarProps) => (
  <div className="border-border/70 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
    <Tabs
      onValueChange={(value) => {
        if (value === "incoming" || value === "outgoing") {
          onChange(value);
        }
      }}
      value={direction}
    >
      <TabsList>
        <TabsTrigger value="incoming">
          Incoming <span className="tabular-nums">{incomingCount}</span>
        </TabsTrigger>
        <TabsTrigger value="outgoing">
          Outgoing <span className="tabular-nums">{outgoingCount}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <InputGroup className="bg-background w-full sm:w-64">
      <InputGroupAddon>
        <IconSearch size={16} aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        aria-label="Search transfers"
        disabled={isMutating}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search transfers"
        type="search"
        value={search}
      />
      {search ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label="Clear search"
            onClick={() => onSearchChange("")}
            size="icon-sm"
          >
            <IconX size={16} aria-hidden="true" />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  </div>
);

/**
 * The signed-in user's transfer inbox.
 *
 * Like the notifications page, this is one Card with a header for the actions
 * and a list of flat rows. The bulk buttons act only on incoming offers, and
 * both ask for confirmation before changing ownership of several projects.
 */
const TransfersPage = () => {
  const client = useQueryClient();
  const [direction, setDirection] = useState<Direction>("incoming");
  const [search, setSearch] = useState("");
  const [confirmation, setConfirmation] = useState<BulkAction | null>(null);

  const query = useQuery({
    queryFn: () => listProjectTransfers(),
    queryKey: [TRANSFERS_QUERY_KEY],
    refetchInterval: 30_000,
  });

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: [TRANSFERS_QUERY_KEY] });
  };

  const respond = useMutation({
    mutationFn: ({ accept, id }: { accept: boolean; id: string }) =>
      respondToProjectTransfer({
        data: { accept, transferId: id },
      }),
    onError: (error) => toast.error(error.message),
    onSuccess: (result) => {
      toast.success(
        result.accepted
          ? `${result.projectName} is now yours.`
          : `You declined the transfer of ${result.projectName}.`
      );
      invalidate();
    },
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      cancelProjectTransfer({ data: { transferId: id } }),
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      toast.success("Transfer offer withdrawn.");
      invalidate();
    },
  });

  const bulk = useMutation({
    mutationFn: async (accept: boolean) => {
      const incoming = query.data?.incoming ?? [];

      const results = await Promise.allSettled(
        incoming.map((item) =>
          respondToProjectTransfer({
            data: { accept, transferId: item.id },
          })
        )
      );

      return {
        failed: results.filter((result) => result.status === "rejected").length,
        succeeded: results.filter((result) => result.status === "fulfilled")
          .length,
      };
    },
    onError: () => toast.error("Could not update those transfers."),
    onSuccess: ({ failed, succeeded }, accept) => {
      if (succeeded > 0) {
        toast.success(
          `${succeeded} offer${succeeded === 1 ? "" : "s"} ${accept ? "accepted" : "denied"}.`
        );
      }

      if (failed > 0) {
        toast.error(
          `${failed} offer${failed === 1 ? "" : "s"} could not be updated.`
        );
      }

      invalidate();
    },
  });

  const incoming = query.data?.incoming ?? [];
  const outgoing = query.data?.outgoing ?? [];
  const isMutating = respond.isPending || cancel.isPending || bulk.isPending;
  const term = search.trim().toLowerCase();

  const items = (direction === "incoming" ? incoming : outgoing).filter(
    (item) =>
      !term ||
      item.projectName.toLowerCase().includes(term) ||
      item.userName.toLowerCase().includes(term)
  );

  const confirmBulk = () => {
    if (confirmation) {
      bulk.mutate(confirmation === "accept");
    }

    setConfirmation(null);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="Project transfers"
        description="Review project ownership offers and track the ones you sent. Offers expire after seven days."
        icon={
          <span className="border-primary/20 bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl border">
            <IconArrowsExchange size={22} aria-hidden="true" />
          </span>
        }
      />

      <Card className="mt-8" size="sm">
        <CardHeader className="border-border/70 border-b">
          <CardTitle className="text-lg">Transfers</CardTitle>
          <CardDescription>
            Offers waiting for your answer, and the ones you have sent.
          </CardDescription>
          <CardAction className="flex flex-wrap items-center gap-2">
            {incoming.length > 0 ? (
              <Badge variant="secondary">
                <span className="tabular-nums">{incoming.length}</span> pending
              </Badge>
            ) : null}
            <Button
              disabled={incoming.length === 0 || isMutating}
              onClick={() => setConfirmation("accept")}
              size="sm"
              type="button"
              variant="outline"
            >
              <IconChecks size={16} aria-hidden="true" />
              Accept all
            </Button>
            <Button
              disabled={incoming.length === 0 || isMutating}
              onClick={() => setConfirmation("deny")}
              size="sm"
              type="button"
              variant="ghost"
            >
              Deny all
            </Button>
          </CardAction>
        </CardHeader>

        <TransferToolbar
          direction={direction}
          incomingCount={incoming.length}
          isMutating={isMutating}
          onChange={setDirection}
          onSearchChange={setSearch}
          outgoingCount={outgoing.length}
          search={search}
        />

        <CardContent className="pt-2 pb-5">
          {query.isPending ? (
            <div aria-busy="true" className="grid gap-4 px-4 py-6">
              {[0, 1, 2].map((index) => (
                <div className="flex items-start gap-3" key={index}>
                  <Skeleton className="size-9 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {query.isError ? (
            <ErrorState
              message={query.error.message}
              onRetry={async () => {
                await query.refetch();
              }}
            />
          ) : null}

          {query.isSuccess && items.length === 0 ? (
            <EmptyTransfers direction={direction} />
          ) : null}

          {query.isSuccess && items.length > 0
            ? items.map((item) => (
                <TransferRow
                  direction={direction}
                  isMutating={isMutating}
                  item={item}
                  key={item.id}
                  onCancel={(id) => cancel.mutate(id)}
                  onRespond={(id, accept) => respond.mutate({ accept, id })}
                />
              ))
            : null}
        </CardContent>
      </Card>

      <ConfirmBulk
        action={confirmation}
        count={incoming.length}
        isPending={bulk.isPending}
        onClose={() => setConfirmation(null)}
        onConfirm={confirmBulk}
      />
    </div>
  );
};

export { TransfersPage };
