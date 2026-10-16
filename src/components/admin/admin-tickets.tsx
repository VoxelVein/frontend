import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  TicketMessageRow,
  TicketRow,
  TicketThread,
} from "@/lib/tickets.functions";
import {
  closeTicket,
  getTicketThread,
  listAllTickets,
  replyToTicket,
  updateTicketTags,
} from "@/lib/tickets.functions";

// oxlint-disable-next-line react-doctor/no-giant-component -- Admin ticket management needs the thread dialog in one place
const AdminTickets = () => {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<TicketThread | null>(null);
  const [reply, setReply] = useState("");
  const [editTags, setEditTags] = useState("");
  const [isMutating, setIsMutating] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTickets(
        await listAllTickets({
          data: { status: "open", tag: tagFilter.trim() || undefined },
        })
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load tickets."
      );
    }
    setIsLoading(false);
  }, [tagFilter]);

  useEffect(() => {
    let isCurrent = true;
    const loadOnMount = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const next = await listAllTickets({
          data: { status: "open", tag: tagFilter.trim() || undefined },
        });
        if (isCurrent) {
          setTickets(next);
        }
      } catch (caughtError) {
        if (isCurrent) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Could not load tickets."
          );
        }
      }
      if (isCurrent) {
        setIsLoading(false);
      }
    };
    loadOnMount();
    return () => {
      isCurrent = false;
    };
  }, [tagFilter]);

  const openThread = async (id: string) => {
    setSelectedId(id);
    setThread(null);
    setReply("");
    setEditTags("");
    try {
      const next = await getTicketThread({ data: { ticketId: id } });
      setThread(next);
      setEditTags(next.ticket.tags.join(", "));
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load ticket."
      );
    }
  };

  const handleSaveTags = async () => {
    if (!selectedId) {
      return;
    }
    setIsMutating(true);
    try {
      const tags = editTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      await updateTicketTags({ data: { tags, ticketId: selectedId } });
      const next = await getTicketThread({ data: { ticketId: selectedId } });
      setThread(next);
      setEditTags(next.ticket.tags.join(", "));
      await load();
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save tags."
      );
    }
    setIsMutating(false);
  };

  const handleReply = async () => {
    if (!selectedId || !reply.trim()) {
      return;
    }
    setIsMutating(true);
    try {
      await replyToTicket({
        data: { body: reply.trim(), ticketId: selectedId },
      });
      setReply("");
      const next = await getTicketThread({ data: { ticketId: selectedId } });
      setThread(next);
      await load();
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not send reply."
      );
    }
    setIsMutating(false);
  };

  const handleClose = async () => {
    if (!selectedId) {
      return;
    }
    setIsMutating(true);
    try {
      await closeTicket({ data: { ticketId: selectedId } });
      setSelectedId(null);
      setThread(null);
      await load();
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not close ticket."
      );
    }
    setIsMutating(false);
  };

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-muted-foreground text-sm">
        {error}{" "}
        <Button
          type="button"
          variant="link"
          onClick={() => {
            load();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex gap-2">
        <input
          aria-label="Filter by tag"
          className="border-input bg-background min-h-11 flex-1 rounded-lg border px-3 text-sm"
          placeholder="Filter by tag"
          value={tagFilter}
          onChange={(event) => setTagFilter(event.target.value)}
        />
      </div>
      <div className="grid gap-3">
        {tickets.length === 0 ? (
          <p className="text-muted-foreground text-sm">No open tickets.</p>
        ) : (
          tickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              className="bg-muted/40 hover:bg-muted flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors"
              onClick={() => {
                openThread(ticket.id);
              }}
            >
              <span className="min-w-0">
                <span className="text-foreground block truncate font-medium">
                  {ticket.subject}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
                  {ticket.requesterName ?? "Unknown"} · {ticket.messageCount}{" "}
                  messages
                </span>
                {ticket.tags.length > 0 ? (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {ticket.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-background text-muted-foreground rounded-full border px-2 py-0.5 text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>
              <span className="text-muted-foreground text-xs">
                {new Date(ticket.updatedAt).toLocaleDateString()}
              </span>
            </button>
          ))
        )}
      </div>

      <Dialog
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setThread(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{thread?.ticket.subject ?? "Ticket"}</DialogTitle>
            <DialogDescription>
              {thread
                ? `${thread.ticket.status} · opened ${new Date(
                    thread.ticket.createdAt
                  ).toLocaleDateString()}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <label
                htmlFor="ticket-tags"
                className="text-foreground text-sm font-medium"
              >
                Tags
              </label>
              <div className="flex gap-2">
                <input
                  id="ticket-tags"
                  value={editTags}
                  onChange={(event) => setEditTags(event.target.value)}
                  disabled={isMutating}
                  placeholder="comma-separated"
                  className="border-input bg-background min-h-11 flex-1 rounded-lg border px-3 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={isMutating}
                  onClick={() => {
                    handleSaveTags();
                  }}
                >
                  Save
                </Button>
              </div>
            </div>

            <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg">
              {thread?.messages.map((message: TicketMessageRow) => (
                <div
                  key={message.id}
                  className="bg-muted/40 rounded-lg border p-3"
                >
                  <p className="text-foreground text-xs font-medium">
                    {message.authorName ?? "User"}{" "}
                    <span className="text-muted-foreground font-normal">
                      · {new Date(message.createdAt).toLocaleString()}
                    </span>
                  </p>
                  <p className="text-foreground mt-1 text-sm whitespace-pre-wrap">
                    {message.body}
                  </p>
                </div>
              )) ?? <Skeleton className="h-24 rounded-lg" />}
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="ticket-reply"
                className="text-foreground text-sm font-medium"
              >
                Reply
              </label>
              <textarea
                id="ticket-reply"
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                disabled={isMutating || !(thread?.canReply ?? false)}
                rows={3}
                className="border-input bg-background text-foreground min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            {thread?.ticket.status === "open" ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={isMutating}
                onClick={() => {
                  handleClose();
                }}
              >
                Close ticket
              </Button>
            ) : null}
            <Button
              type="button"
              className="min-h-11"
              disabled={
                isMutating || !reply.trim() || !(thread?.canReply ?? false)
              }
              onClick={() => {
                handleReply();
              }}
            >
              {isMutating ? "Sending…" : "Send reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export { AdminTickets };
