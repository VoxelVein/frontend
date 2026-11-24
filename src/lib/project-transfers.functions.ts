import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import {
  boolean,
  maxLength,
  minLength,
  object,
  optional,
  parse,
  pipe,
  string,
  uuid,
} from "valibot";

import { db } from "@/db";
import {
  projects,
  projectTransfers,
  userNotifications,
  users,
} from "@/db/schema";
import { PROJECT_ACCESS_ERROR, ProjectAccessError } from "@/lib/project-access";
import {
  requireSession,
  verifyReauthentication,
} from "@/lib/project-transfer-auth";
import { PROJECT_TRANSFER_EXPIRY_MS } from "@/lib/project-transfers";
import { requireCapability } from "@/lib/role-guards";
import { normalizeUsername } from "@/lib/usernames";

const RECIPIENT_MAX_LENGTH = 320;
const PASSWORD_MAX_LENGTH = 128;

const ACCEPTED_NOTIFICATION = "project-transfer-accepted";
const DECLINED_NOTIFICATION = "project-transfer-declined";

interface RequestTransferInput {
  password?: string;
  projectId: string;
  recipient: string;
}

interface RespondTransferInput {
  accept: boolean;
  transferId: string;
}

interface CancelTransferInput {
  transferId: string;
}

interface AdminTransferInput {
  projectId: string;
  recipient: string;
}

export class TransferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferError";
  }
}

const findRecipient = async (identifier: string) => {
  const needle = normalizeUsername(identifier);

  const [recipient] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
    })
    .from(users)
    .where(
      and(
        isNull(users.deletionRequestedAt),
        or(
          eq(sql`lower(${users.username})`, needle),
          eq(sql`lower(${users.email})`, needle)
        )
      )
    )
    .limit(1);

  return recipient;
};

const requireProject = async (projectId: string) => {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || project.status === "removed") {
    throw new ProjectAccessError(PROJECT_ACCESS_ERROR.notFound);
  }

  return project;
};

const requestSchema = object({
  password: optional(pipe(string(), maxLength(PASSWORD_MAX_LENGTH))),
  projectId: pipe(string(), uuid()),
  recipient: pipe(string(), minLength(1), maxLength(RECIPIENT_MAX_LENGTH)),
});

/**
 * Owner-initiated hand-off. Re-authentication proves the person at the
 * keyboard is the owner, and the recipient must accept before anything moves.
 */
export const requestProjectTransfer = createServerFn({ method: "POST" })
  .validator((data: RequestTransferInput) => parse(requestSchema, data))
  .handler(
    async ({
      data,
    }): Promise<{
      expiresAt: string;
      id: string;
      recipientName: string;
    }> => {
      const session = await requireSession();
      const project = await requireProject(data.projectId);

      if (project.ownerId !== session.user.id) {
        throw new ProjectAccessError(PROJECT_ACCESS_ERROR.forbidden);
      }

      if (!(await verifyReauthentication(session, data.password))) {
        throw new TransferError(
          "Confirm it's you before transferring a project."
        );
      }

      const recipient = await findRecipient(data.recipient);

      if (!recipient) {
        throw new TransferError(
          "No account matches that username or email address."
        );
      }

      if (recipient.id === session.user.id) {
        throw new TransferError("You already own this project.");
      }

      const [existing] = await db
        .select({ id: projectTransfers.id })
        .from(projectTransfers)
        .where(
          and(
            eq(projectTransfers.projectId, project.id),
            eq(projectTransfers.status, "pending")
          )
        )
        .limit(1);

      if (existing) {
        throw new TransferError(
          "A transfer for this project is already waiting for a reply."
        );
      }

      const expiresAt = new Date(Date.now() + PROJECT_TRANSFER_EXPIRY_MS);

      const [transfer] = await db
        .insert(projectTransfers)
        .values({
          expiresAt,
          fromUserId: session.user.id,
          projectId: project.id,
          status: "pending",
          toUserId: recipient.id,
        })
        .returning({ id: projectTransfers.id });

      await db.insert(userNotifications).values({
        message: `${session.user.name} offered you "${project.name}". Accept or decline it in your transfers inbox within seven days.`,
        projectId: project.id,
        title: "Project transfer offered",
        type: "project-transfer-offered",
        userId: recipient.id,
      });

      return {
        expiresAt: expiresAt.toISOString(),
        id: transfer.id,
        recipientName: recipient.name,
      };
    }
  );

export interface ProjectTransferListItem {
  createdAt: string;
  expiresAt: string;
  id: string;
  projectId: string;
  projectName: string;
  userName: string;
}

/** Pending offers for the signed-in user, split by direction. */
export const listProjectTransfers = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    incoming: ProjectTransferListItem[];
    outgoing: ProjectTransferListItem[];
  }> => {
    const session = await requireSession();

    const select = {
      createdAt: projectTransfers.createdAt,
      expiresAt: projectTransfers.expiresAt,
      id: projectTransfers.id,
      projectId: projectTransfers.projectId,
      projectName: projects.name,
      userName: users.name,
    };

    const [incoming, outgoing] = await Promise.all([
      db
        .select(select)
        .from(projectTransfers)
        .innerJoin(projects, eq(projects.id, projectTransfers.projectId))
        .innerJoin(users, eq(users.id, projectTransfers.fromUserId))
        .where(
          and(
            eq(projectTransfers.toUserId, session.user.id),
            eq(projectTransfers.status, "pending")
          )
        )
        .orderBy(desc(projectTransfers.createdAt)),
      db
        .select(select)
        .from(projectTransfers)
        .innerJoin(projects, eq(projects.id, projectTransfers.projectId))
        .innerJoin(users, eq(users.id, projectTransfers.toUserId))
        .where(
          and(
            eq(projectTransfers.fromUserId, session.user.id),
            eq(projectTransfers.status, "pending")
          )
        )
        .orderBy(desc(projectTransfers.createdAt)),
    ]);

    const toItem = (
      row: (typeof incoming)[number]
    ): ProjectTransferListItem => ({
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      id: row.id,
      projectId: row.projectId,
      projectName: row.projectName,
      userName: row.userName,
    });

    return {
      incoming: incoming.map(toItem),
      outgoing: outgoing.map(toItem),
    };
  }
);

const respondSchema = object({
  accept: boolean(),
  transferId: pipe(string(), uuid()),
});

/** Accept or decline an offer sent to the signed-in user. */
export const respondToProjectTransfer = createServerFn({ method: "POST" })
  .validator((data: RespondTransferInput) => parse(respondSchema, data))
  .handler(
    async ({ data }): Promise<{ accepted: boolean; projectName: string }> => {
      const session = await requireSession();

      const [transfer] = await db
        .select()
        .from(projectTransfers)
        .where(eq(projectTransfers.id, data.transferId))
        .limit(1);

      if (!transfer || transfer.status !== "pending") {
        throw new TransferError(
          "This transfer is no longer waiting for a reply."
        );
      }

      if (transfer.toUserId !== session.user.id) {
        throw new ProjectAccessError(PROJECT_ACCESS_ERROR.forbidden);
      }

      if (transfer.expiresAt.getTime() < Date.now()) {
        throw new TransferError("This transfer offer has expired.");
      }

      return await db.transaction(async (tx) => {
        const [project] = await tx
          .select({ name: projects.name, ownerId: projects.ownerId })
          .from(projects)
          .where(eq(projects.id, transfer.projectId))
          .limit(1);

        if (!project) {
          throw new ProjectAccessError(PROJECT_ACCESS_ERROR.notFound);
        }

        if (project.ownerId !== transfer.fromUserId) {
          throw new TransferError(
            "The project changed owners since this offer was made."
          );
        }

        if (data.accept) {
          await tx
            .update(projects)
            .set({ ownerId: session.user.id })
            .where(eq(projects.id, transfer.projectId));
        }

        await tx
          .update(projectTransfers)
          .set({
            resolvedAt: new Date(),
            status: data.accept ? "accepted" : "declined",
          })
          .where(eq(projectTransfers.id, transfer.id));

        if (transfer.fromUserId) {
          await tx.insert(userNotifications).values({
            message: data.accept
              ? `${session.user.name} accepted your transfer of "${project.name}". It now belongs to them.`
              : `${session.user.name} declined your transfer of "${project.name}". You still own it.`,
            projectId: transfer.projectId,
            title: data.accept
              ? "Project transfer accepted"
              : "Project transfer declined",
            type: data.accept ? ACCEPTED_NOTIFICATION : DECLINED_NOTIFICATION,
            userId: transfer.fromUserId,
          });
        }

        return { accepted: data.accept, projectName: project.name };
      });
    }
  );

const cancelSchema = object({ transferId: pipe(string(), uuid()) });

/** Sender withdraws an offer that has not been answered yet. */
export const cancelProjectTransfer = createServerFn({ method: "POST" })
  .validator((data: CancelTransferInput) => parse(cancelSchema, data))
  .handler(async ({ data }): Promise<void> => {
    const session = await requireSession();

    const [transfer] = await db
      .select()
      .from(projectTransfers)
      .where(eq(projectTransfers.id, data.transferId))
      .limit(1);

    if (!transfer || transfer.status !== "pending") {
      throw new TransferError(
        "This transfer is no longer waiting for a reply."
      );
    }

    if (transfer.fromUserId !== session.user.id) {
      throw new ProjectAccessError(PROJECT_ACCESS_ERROR.forbidden);
    }

    await db
      .update(projectTransfers)
      .set({ resolvedAt: new Date(), status: "cancelled" })
      .where(eq(projectTransfers.id, transfer.id));
  });

const adminSchema = object({
  projectId: pipe(string(), uuid()),
  recipient: pipe(string(), minLength(1), maxLength(RECIPIENT_MAX_LENGTH)),
});

/** Staff hand-off: immediate, with no offer for the new owner to accept. */
export const adminTransferProject = createServerFn({ method: "POST" })
  .validator((data: AdminTransferInput) => parse(adminSchema, data))
  .handler(async ({ data }): Promise<{ projectName: string }> => {
    await requireCapability("manageTransfers");

    const project = await requireProject(data.projectId);
    const recipient = await findRecipient(data.recipient);

    if (!recipient) {
      throw new TransferError(
        "No account matches that username or email address."
      );
    }

    if (project.ownerId === recipient.id) {
      throw new TransferError("That user already owns this project.");
    }

    const previousOwnerId = project.ownerId;

    await db.transaction(async (tx) => {
      await tx
        .update(projectTransfers)
        .set({ resolvedAt: new Date(), status: "cancelled" })
        .where(
          and(
            eq(projectTransfers.projectId, project.id),
            eq(projectTransfers.status, "pending")
          )
        );

      const now = new Date();

      await tx.insert(projectTransfers).values({
        expiresAt: now,
        fromUserId: previousOwnerId,
        projectId: project.id,
        resolvedAt: now,
        status: "accepted",
        toUserId: recipient.id,
      });

      await tx
        .update(projects)
        .set({ ownerId: recipient.id })
        .where(eq(projects.id, project.id));

      await tx.insert(userNotifications).values({
        message: `An admin moved "${project.name}" to your account. You now own it.`,
        projectId: project.id,
        title: "Project transferred to you",
        type: ACCEPTED_NOTIFICATION,
        userId: recipient.id,
      });

      if (previousOwnerId) {
        await tx.insert(userNotifications).values({
          message: `An admin moved "${project.name}" from your account to ${recipient.name}.`,
          projectId: project.id,
          title: "Project transferred",
          type: ACCEPTED_NOTIFICATION,
          userId: previousOwnerId,
        });
      }
    });

    return { projectName: project.name };
  });
