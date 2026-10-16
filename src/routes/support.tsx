import { createFileRoute, redirect } from "@tanstack/react-router";
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
import { getSession } from "@/lib/auth.functions";
import type { TicketRow, TicketThread } from "@/lib/tickets.functions";
import {
  closeTicket,
  getTicketThread,
  listMyTickets,
  openTicket,
  replyToTicket,
} from "@/lib/tickets.functions";

const MAX_OPEN_TICKETS = 5;

// oxlint-disable-next-line react-doctor/no-giant-component, react-doctor/prefer-useReducer -- Splitting SupportPage further would require major refactoring
const SupportPage = () => {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<TicketThread | null>(null);
  const [reply, setReply] = useState("");
  const [isMutating, setIsMutating] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTickets(await listMyTickets());
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load tickets."
      );
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let isCurrent = true;
    const loadOnMount = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const next = await listMyTickets();
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
  }, []);

  const openCount = tickets.filter((ticket) => ticket.status === "open").length;

  const handleCreate = async () => {
    setIsSubmitting(true);
    try {
      const created = await openTicket({
        data: {
          message: message.trim(),
          subject: subject.trim(),
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
      });
      setIsCreateOpen(false);
      setSubject("");
      setMessage("");
      toast.success("Ticket opened.");
      setSelectedId(created.id);
      setThread(await getTicketThread({ data: { ticketId: created.id } }));
      await load();
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not open ticket."
      );
    }
    setIsSubmitting(false);
  };

  const openThread = async (id: string) => {
    setSelectedId(id);
    setThread(null);
    setReply("");
    try {
      setThread(await getTicketThread({ data: { ticketId: id } }));
    } catch (caughtError) {
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load ticket."
      );
    }
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
      setThread(await getTicketThread({ data: { ticketId: selectedId } }));
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
      setThread(await getTicketThread({ data: { ticketId: selectedId } }));
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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Support
        </h1>
        <Button
          type="button"
          disabled={openCount >= MAX_OPEN_TICKETS}
          onClick={() => setIsCreateOpen(true)}
        >
          New ticket
        </Button>
      </div>
      <p className="text-muted-foreground mt-2 text-sm">
        Open a ticket to contact the team. You can have up to {MAX_OPEN_TICKETS}{" "}
        open tickets at a time.
      </p>

      {(() => {
        if (isLoading) {
          return (
            <div className="mt-6 grid gap-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="bg-muted h-16 rounded-lg" />
              ))}
            </div>
          );
        }
        if (error) {
          return (
            <p className="text-muted-foreground mt-6 text-sm">
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
            </p>
          );
        }
        if (tickets.length === 0) {
          return (
            <p className="text-muted-foreground mt-6 text-sm">
              You have no tickets yet.
            </p>
          );
        }
        return (
          <div className="mt-6 grid gap-3">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                className="bg-muted/40 hover:bg-muted flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left"
                onClick={() => {
                  openThread(ticket.id);
                }}
              >
                <span className="min-w-0">
                  <span className="text-foreground block truncate font-medium">
                    {ticket.subject}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {ticket.status} · {ticket.messageCount} messages
                  </span>
                </span>
                <span className="text-muted-foreground text-xs">
                  {new Date(ticket.updatedAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        );
      })()}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Open a ticket</DialogTitle>
            <DialogDescription>
              Describe the issue or question.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label
                htmlFor="ticket-subject"
                className="text-foreground text-sm font-medium"
              >
                Subject
              </label>
              <input
                id="ticket-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                disabled={isSubmitting}
                className="border-input bg-background min-h-11 w-full rounded-lg border px-3 text-sm"
              />
            </div>
            <div className="grid gap-2">
              <label
                htmlFor="ticket-message"
                className="text-foreground text-sm font-medium"
              >
                Message
              </label>
              <textarea
                id="ticket-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={isSubmitting}
                rows={4}
                className="border-input bg-background min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-2">
              <label
                htmlFor="ticket-tags"
                className="text-foreground text-sm font-medium"
              >
                Tags (comma-separated)
              </label>
              <input
                id="ticket-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                disabled={isSubmitting}
                className="border-input bg-background min-h-11 w-full rounded-lg border px-3 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={isSubmitting}
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={
                isSubmitting ||
                subject.trim().length < 3 ||
                message.trim().length === 0
              }
              onClick={() => {
                handleCreate();
              }}
            >
              {isSubmitting ? "Opening…" : "Open ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

          <div className="max-h-80 space-y-3 overflow-y-auto">
            {thread ? (
              thread.messages.map((msg) => (
                <div key={msg.id} className="bg-muted/40 rounded-lg border p-3">
                  <p className="text-foreground text-xs font-medium">
                    {msg.authorName ?? "User"}{" "}
                    <span className="text-muted-foreground font-normal">
                      · {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </p>
                  <p className="text-foreground mt-1 text-sm whitespace-pre-wrap">
                    {msg.body}
                  </p>
                </div>
              ))
            ) : (
              <div className="bg-muted h-24 rounded-lg" />
            )}
          </div>

          <div className="grid gap-2">
            <label
              htmlFor="ticket-reply-2"
              className="text-foreground text-sm font-medium"
            >
              Reply
            </label>
            <textarea
              id="ticket-reply-2"
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              disabled={isMutating || !(thread?.canReply ?? false)}
              rows={3}
              className="border-input bg-background min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
            />
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

export const Route = createFileRoute("/support")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    return { session };
  },
  component: SupportPage,
});
