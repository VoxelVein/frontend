import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { object, optional, parse, picklist, pipe, string, uuid } from "valibot";

import { db } from "@/db";
import { supportTicketMessages, supportTickets, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  consumeServerLimit,
  RATE_LIMIT_MESSAGE,
} from "@/lib/rate-limit-server";
import { requireCapability } from "@/lib/role-guards";
import type { StaffSession } from "@/lib/role-guards";
import { can } from "@/lib/roles";
import {
  ticketOpenSchema,
  ticketReplySchema,
  ticketTagsSchema,
  toTicketStatus,
} from "@/lib/tickets";
import type { TicketStatus } from "@/lib/tickets";

export interface TicketMessageRow {
  authorId: string | null;
  authorName: string | null;
  authorRole: string | null;
  body: string;
  createdAt: Date | string;
  id: string;
  internal: boolean;
}

export interface TicketRow {
  createdAt: Date | string;
  id: string;
  messageCount: number;
  requesterEmail: string | null;
  requesterId: string;
  requesterName: string | null;
  requesterUsername: string | null;
  status: TicketStatus;
  subject: string;
  tags: string[];
  updatedAt: Date | string;
}

const OPEN_STATUS = "open" as const;
const TICKET_NOT_FOUND = "Ticket not found.";

const requireMember = async (): Promise<StaffSession> => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) {
    throw new Error("Sign in to use support tickets.");
  }
  // SAFETY: `auth.api.getSession` returns a session compatible with StaffSession.
  return session as StaffSession;
};

const isStaff = (role: string | null | undefined): boolean =>
  can(role, "manageTickets");

export const openTicket = createServerFn({ method: "POST" })
  .validator((data: { message: string; subject: string; tags?: string[] }) =>
    parse(ticketOpenSchema, data)
  )
  .handler(
    async ({
      data,
    }: {
      data: { message: string; subject: string; tags?: string[] };
    }) => {
      const session = await requireMember();
      const quota = await consumeServerLimit(
        "ticket-open",
        `user:${session.user.id}`,
        RATE_LIMITS.ticketOpen
      );
      if (quota) {
        throw new Error(RATE_LIMIT_MESSAGE);
      }

      const [row] = await db
        .select({ total: count() })
        .from(supportTickets)
        .where(
          and(
            eq(supportTickets.userId, session.user.id),
            eq(supportTickets.status, OPEN_STATUS)
          )
        );
      if ((row?.total ?? 0) >= 5) {
        throw new Error(
          "You already have 5 open tickets. Close one before opening another."
        );
      }

      const ticket = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(supportTickets)
          .values({
            subject: data.subject.trim(),
            tags: (() => {
              const normalized: string[] = [];
              for (const tag of data.tags ?? []) {
                const value = tag.trim();
                if (value) {
                  normalized.push(value);
                }
              }
              return normalized;
            })(),
            userId: session.user.id,
          })
          .returning();
        await tx.insert(supportTicketMessages).values({
          authorUserId: session.user.id,
          body: data.message.trim(),
          ticketId: inserted.id,
        });
        return inserted;
      });

      return { id: ticket.id };
    }
  );

export const listMyTickets = createServerFn({ method: "GET" }).handler(
  async (): Promise<TicketRow[]> => {
    const session = await requireMember();
    const rows = await db
      .select({
        createdAt: supportTickets.createdAt,
        id: supportTickets.id,
        messageCount: count(supportTicketMessages.id),
        requesterEmail: users.email,
        requesterId: supportTickets.userId,
        requesterName: users.name,
        requesterUsername: users.username,
        status: supportTickets.status,
        subject: supportTickets.subject,
        tags: supportTickets.tags,
        updatedAt: supportTickets.updatedAt,
      })
      .from(supportTickets)
      .leftJoin(users, eq(users.id, supportTickets.userId))
      .leftJoin(
        supportTicketMessages,
        eq(supportTicketMessages.ticketId, supportTickets.id)
      )
      .where(eq(supportTickets.userId, session.user.id))
      .groupBy(supportTickets.id, users.email, users.name, users.username)
      .orderBy(desc(supportTickets.updatedAt));

    return rows.map((row) => ({
      createdAt: row.createdAt,
      id: row.id,
      messageCount: Number(row.messageCount ?? 0),
      requesterEmail: row.requesterEmail ?? null,
      requesterId: row.requesterId,
      requesterName: row.requesterName ?? null,
      requesterUsername: row.requesterUsername ?? null,
      status: toTicketStatus(row.status),
      subject: row.subject,
      tags: row.tags ?? [],
      updatedAt: row.updatedAt,
    }));
  }
);

export const listAllTickets = createServerFn({ method: "GET" })
  .validator((data: { status?: "open" | "closed"; tag?: string }) =>
    parse(
      object({
        status: optional(picklist(["open", "closed"])),
        tag: optional(string()),
      }),
      data ?? {}
    )
  )
  .handler(
    async ({
      data,
    }: {
      data: { status?: "open" | "closed"; tag?: string };
    }): Promise<TicketRow[]> => {
      await requireCapability("manageTickets");
      const status = data?.status;
      const tag = data?.tag?.trim();
      const conditions = [];
      if (status === OPEN_STATUS || status === "closed") {
        conditions.push(eq(supportTickets.status, status));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const rows = await db
        .select({
          createdAt: supportTickets.createdAt,
          id: supportTickets.id,
          messageCount: count(supportTicketMessages.id),
          requesterEmail: users.email,
          requesterId: supportTickets.userId,
          requesterName: users.name,
          requesterUsername: users.username,
          status: supportTickets.status,
          subject: supportTickets.subject,
          tags: supportTickets.tags,
          updatedAt: supportTickets.updatedAt,
        })
        .from(supportTickets)
        .leftJoin(users, eq(users.id, supportTickets.userId))
        .leftJoin(
          supportTicketMessages,
          eq(supportTicketMessages.ticketId, supportTickets.id)
        )
        .where(where)
        .groupBy(supportTickets.id, users.email, users.name, users.username)
        .orderBy(desc(supportTickets.updatedAt));

      const normalized = (tag ?? "").toLowerCase();
      const mapped = rows.map((row) => ({
        createdAt: row.createdAt,
        id: row.id,
        messageCount: Number(row.messageCount ?? 0),
        requesterEmail: row.requesterEmail ?? null,
        requesterId: row.requesterId,
        requesterName: row.requesterName ?? null,
        requesterUsername: row.requesterUsername ?? null,
        status: toTicketStatus(row.status),
        subject: row.subject,
        tags: row.tags ?? [],
        updatedAt: row.updatedAt,
      }));
      if (!normalized) {
        return mapped;
      }
      return mapped.filter((ticket) =>
        ticket.tags.some((tagName) =>
          tagName.toLowerCase().includes(normalized)
        )
      );
    }
  );

export const getTicketThread = createServerFn({ method: "GET" })
  .validator((data: { ticketId: string }) =>
    parse(object({ ticketId: pipe(string(), uuid()) }), data)
  )
  .handler(async ({ data }: { data: { ticketId: string } }) => {
    const session = await requireMember();
    const staff = isStaff(session.user.role);
    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, data.ticketId))
      .limit(1);
    if (!ticket) {
      throw new Error(TICKET_NOT_FOUND);
    }
    if (!staff && ticket.userId !== session.user.id) {
      throw new Error("You cannot view this ticket.");
    }
    const rows = await db
      .select({
        authorId: supportTicketMessages.authorUserId,
        authorName: users.name,
        authorRole: users.role,
        body: supportTicketMessages.body,
        createdAt: supportTicketMessages.createdAt,
        id: supportTicketMessages.id,
        internal: supportTicketMessages.internal,
      })
      .from(supportTicketMessages)
      .leftJoin(users, eq(users.id, supportTicketMessages.authorUserId))
      .where(eq(supportTicketMessages.ticketId, data.ticketId))
      .orderBy(asc(supportTicketMessages.createdAt));

    const messages: TicketMessageRow[] = [];
    for (const row of rows) {
      if (staff || !row.internal) {
        messages.push({
          authorId: row.authorId ?? null,
          authorName: row.authorName ?? null,
          authorRole: row.authorRole ?? null,
          body: row.body,
          createdAt: row.createdAt,
          id: row.id,
          internal: row.internal,
        });
      }
    }

    return {
      canReply: staff || ticket.status === OPEN_STATUS,
      messages,
      ticket: {
        createdAt: ticket.createdAt,
        id: ticket.id,
        requesterId: ticket.userId,
        status: toTicketStatus(ticket.status),
        subject: ticket.subject,
        tags: ticket.tags ?? [],
        updatedAt: ticket.updatedAt,
      },
    };
  });

export const replyToTicket = createServerFn({ method: "POST" })
  .validator((data: { body: string; ticketId: string }) =>
    parse(ticketReplySchema, data)
  )
  .handler(async ({ data }: { data: { body: string; ticketId: string } }) => {
    const session = await requireMember();
    const staff = isStaff(session.user.role);
    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, data.ticketId))
      .limit(1);
    if (!ticket) {
      throw new Error(TICKET_NOT_FOUND);
    }
    if (!staff && ticket.userId !== session.user.id) {
      throw new Error("You cannot reply to this ticket.");
    }
    if (!staff && ticket.status === "closed") {
      throw new Error("This ticket is closed.");
    }

    const quota = await consumeServerLimit(
      "ticket-reply",
      `user:${session.user.id}`,
      RATE_LIMITS.ticketReply
    );
    if (quota) {
      throw new Error(RATE_LIMIT_MESSAGE);
    }

    await db.transaction(async (tx) => {
      await tx.insert(supportTicketMessages).values({
        authorUserId: session.user.id,
        body: data.body.trim(),
        ticketId: data.ticketId,
      });
      await tx
        .update(supportTickets)
        .set({
          status: staff ? ticket.status : "open",
          updatedAt: new Date(),
        })
        .where(eq(supportTickets.id, data.ticketId));
    });

    return { ok: true };
  });

export const closeTicket = createServerFn({ method: "POST" })
  .validator((data: { ticketId: string }) =>
    parse(object({ ticketId: pipe(string(), uuid()) }), data)
  )
  .handler(async ({ data }: { data: { ticketId: string } }) => {
    const session = await requireMember();
    const staff = isStaff(session.user.role);
    const [ticket] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, data.ticketId))
      .limit(1);
    if (!ticket) {
      throw new Error(TICKET_NOT_FOUND);
    }
    if (!staff && ticket.userId !== session.user.id) {
      throw new Error("You cannot close this ticket.");
    }
    await db
      .update(supportTickets)
      .set({ closedAt: new Date(), status: "closed", updatedAt: new Date() })
      .where(eq(supportTickets.id, data.ticketId));
    return { ok: true };
  });

export const updateTicketTags = createServerFn({ method: "POST" })
  .validator((data: { tags: string[]; ticketId: string }) =>
    parse(ticketTagsSchema, data)
  )
  .handler(async ({ data }: { data: { tags: string[]; ticketId: string } }) => {
    await requireCapability("manageTickets");
    await db
      .update(supportTickets)
      .set({
        tags: (() => {
          const normalized: string[] = [];
          for (const tag of data.tags) {
            const value = tag.trim();
            if (value) {
              normalized.push(value);
            }
          }
          return normalized;
        })(),
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, data.ticketId));
    return { ok: true };
  });

export type TicketThread = Awaited<ReturnType<typeof getTicketThread>>;
