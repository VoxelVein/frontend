/* oxlint-disable anti-slop/no-unknown-parameters -- Server function validators parse untrusted input at the HTTP boundary. */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, count, desc, eq, gt, or, sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  maxLength,
  minLength,
  number,
  object,
  optional,
  parse,
  picklist,
  pipe,
  string,
  trim,
  uuid,
} from "valibot";

import { db } from "@/db";
import {
  projects,
  userNotifications,
  projectImages,
  serverVoteConfig,
  serverVotes,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { getForwardedClientIp } from "@/lib/client-key";
import { requireEditableProject } from "@/lib/project-access";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  consumeServerLimit,
  RATE_LIMIT_MESSAGE,
} from "@/lib/rate-limit-server";
import {
  VOTE_COOLDOWN_MS,
  VOTE_TIMEFRAMES,
  timeframeWindowMs,
} from "@/lib/server-voting";
import { parseHostnames, verifyTurnstileToken } from "@/lib/turnstile";
import type { VoteProtocol } from "@/lib/server-voting";
import {
  sendVoteNotification,
  VOTE_SERVICE_NAME_MAX_BYTES,
} from "@/lib/votifier";
import { decryptVoteToken, encryptVoteToken } from "@/lib/voting-credentials";

/**
 * How a vote's reward notification ended. `unconfirmed` is written before
 * delivery starts, so a vote whose final status could not be saved stays
 * distinct from one that was never attempted.
 */
export type VoteDeliveryStatus = "disabled" | "unconfirmed" | "sent" | "failed";

/** Only v2 signs with the shared token; v1 encrypts with the RSA public key. */
const deliveryCredentials = (config: {
  protocol: VoteProtocol;
  token: string | null;
  publicKey: string | null;
}) => ({
  token:
    config.protocol === "v2" && config.token
      ? decryptVoteToken(config.token)
      : null,
  publicKey: config.publicKey,
});

const projectSchema = object({ projectId: pipe(string(), uuid()) });

const playerSchema = object({
  minecraftUsername: pipe(string(), trim(), minLength(1), maxLength(16)),
  edition: picklist(["java", "bedrock"]),
});

const voteSchema = object({
  ...projectSchema.entries,
  ...playerSchema.entries,
  token: optional(pipe(string(), maxLength(2048))),
});

const owner = async (projectId: string) => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });

  if (!session) {
    throw new Error("Sign in to manage voting.");
  }

  const project = await requireEditableProject(session, projectId);

  if (project.type !== "server") {
    throw new Error("Only servers have voting settings.");
  }

  return session;
};

const limit = async (identity: string) => {
  if (await consumeServerLimit("server-voting", identity, RATE_LIMITS.write)) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }
};

export const castVote = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(voteSchema, data))
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });

    if (!session || session.user.banned) {
      throw new Error("Sign in to vote.");
    }

    if (!session.user.emailVerified) {
      throw new Error("Verify your email before voting.");
    }

    await limit(`user:${session.user.id}`);

    const address = getForwardedClientIp(
      headers,
      process.env.TRUST_PROXY === "true"
    );

    if (address) {
      await limit(`ip:${address}`);
    }

    const validName =
      data.edition === "java"
        ? /^\w{3,16}$/u
        : /^[A-Za-z0-9_. ][A-Za-z0-9_. ]{0,15}$/u;

    if (!validName.test(data.minecraftUsername)) {
      throw new Error("Enter a valid Minecraft username for your edition.");
    }

    if (process.env.TURNSTILE_SECRET || process.env.NODE_ENV === "production") {
      const verified = await verifyTurnstileToken(
        { expectedAction: "vote", token: data.token, remoteIp: address },
        {
          secret: process.env.TURNSTILE_SECRET ?? null,
          hostnames: parseHostnames(process.env.TURNSTILE_HOSTNAMES),
          isProduction: process.env.NODE_ENV === "production",
        }
      );

      if (!verified.ok) {
        throw new Error("Complete the anti-bot check before voting.");
      }
    }

    const recorded = await db.transaction(async (tx) => {
      // A per-project row lock serializes every cooldown check and increment across instances.
      const [project] = await tx
        .select()
        .from(projects)
        .where(eq(projects.id, data.projectId))
        .for("update");

      if (
        !project ||
        project.type !== "server" ||
        project.status !== "published" ||
        project.pendingDeletion
      ) {
        throw new Error("This server is unavailable.");
      }

      const [config] = await tx
        .select()
        .from(serverVoteConfig)
        .where(eq(serverVoteConfig.projectId, data.projectId));

      if (!config?.votingEnabled) {
        throw new Error("Voting is disabled for this server.");
      }

      const now = new Date();

      const [previous] = await tx
        .select({ votedAt: serverVotes.votedAt })
        .from(serverVotes)
        .where(
          and(
            eq(serverVotes.projectId, data.projectId),
            gt(serverVotes.votedAt, new Date(now.getTime() - VOTE_COOLDOWN_MS)),
            or(
              eq(serverVotes.userId, session.user.id),
              and(
                eq(serverVotes.edition, data.edition),
                sql`lower(${serverVotes.minecraftUsername}) = ${data.minecraftUsername.toLowerCase()}`
              ),
              address ? eq(serverVotes.address, address) : undefined
            )
          )
        )
        .orderBy(desc(serverVotes.votedAt))
        .limit(1);

      if (previous) {
        throw new Error(
          `Vote cooldown ends at ${new Date(previous.votedAt.getTime() + VOTE_COOLDOWN_MS).toISOString()}.`
        );
      }

      const [vote] = await tx
        .insert(serverVotes)
        .values({
          address,
          projectId: data.projectId,
          userId: session.user.id,
          minecraftUsername: data.minecraftUsername,
          edition: data.edition,
          votedAt: now,
          deliveryStatus: config.host ? "unconfirmed" : "disabled",
        })
        .returning();

      if (!vote) {
        throw new Error("Vote could not be recorded.");
      }

      const [updated] = await tx
        .update(projects)
        .set({ totalVotes: sql`${projects.totalVotes} + 1` })
        .where(eq(projects.id, data.projectId))
        .returning({ totalVotes: projects.totalVotes });

      return {
        vote,
        config,
        totalVotes: updated?.totalVotes ?? 0,
        nextVoteAt: new Date(now.getTime() + VOTE_COOLDOWN_MS).toISOString(),
      };
    });

    let delivery = { ok: true, detail: "No reward integration configured." };

    try {
      if (recorded.config.host) {
        delivery = await sendVoteNotification(
          recorded.config.host,
          recorded.config.port,
          recorded.config.protocol,
          {
            serviceName: recorded.config.serviceName || "VoxelVein",
            username: data.minecraftUsername,
            address: address ?? "0.0.0.0",
            timestamp: recorded.vote.votedAt.getTime(),
          },
          deliveryCredentials(recorded.config)
        );
      }
    } catch {
      delivery = { ok: false, detail: "Reward credential could not be read." };
    }

    let deliveryStatus: VoteDeliveryStatus = "disabled";

    if (recorded.config.host) {
      deliveryStatus = delivery.ok ? "sent" : "failed";
    }

    try {
      await db
        .update(serverVotes)
        .set({
          deliveryStatus,
          deliveryDetail: delivery.detail,
        })
        .where(eq(serverVotes.id, recorded.vote.id));
    } catch (error) {
      // The row keeps "unconfirmed", so the owner sees an unresolved vote
      // rather than one that looks unattempted. Resending would double reward.
      console.error(
        "Vote accepted but delivery outcome could not be recorded",
        recorded.vote.id,
        error
      );
    }

    // "sent" means the packet reached the listener; neither protocol confirms
    // that a reward was actually granted in game.
    return {
      totalVotes: recorded.totalVotes,
      nextVoteAt: recorded.nextVoteAt,
      deliveryStatus,
    };
  });

export const voteCooldown = createServerFn({ method: "GET" })
  .validator((data: unknown) => parse(projectSchema, data))
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });

    const address = getForwardedClientIp(
      headers,
      process.env.TRUST_PROXY === "true"
    );

    const [[project], [config]] = await Promise.all([
      db
        .select({ totalVotes: projects.totalVotes, status: projects.status })
        .from(projects)
        .where(
          and(
            eq(projects.id, data.projectId),
            eq(projects.type, "server"),
            eq(projects.pendingDeletion, false)
          )
        ),
      db
        .select({ enabled: serverVoteConfig.votingEnabled })
        .from(serverVoteConfig)
        .where(eq(serverVoteConfig.projectId, data.projectId)),
    ]);

    const [previous] = session
      ? await db
          .select({ votedAt: serverVotes.votedAt })
          .from(serverVotes)
          .where(
            and(
              eq(serverVotes.projectId, data.projectId),
              or(
                eq(serverVotes.userId, session.user.id),
                address ? eq(serverVotes.address, address) : undefined
              )
            )
          )
          .orderBy(desc(serverVotes.votedAt))
          .limit(1)
      : [];

    const next = previous ? previous.votedAt.getTime() + VOTE_COOLDOWN_MS : 0;

    return {
      totalVotes: project?.status === "published" ? project.totalVotes : 0,
      enabled: project?.status === "published" && !!config?.enabled,
      nextVoteAt: next > Date.now() ? new Date(next).toISOString() : null,
    };
  });

const configSchema = object({
  ...projectSchema.entries,
  votingEnabled: boolean(),
  host: pipe(
    string(),
    trim(),
    maxLength(253),
    check(
      (value) => !/[\s/\\:@]/u.test(value),
      "Enter a hostname or IPv4 address."
    )
  ),
  port: pipe(
    number(),
    integer(),
    check((value) => value > 0 && value <= 65_535)
  ),
  protocol: picklist(["v1", "v2"]),
  serviceName: pipe(
    string(),
    trim(),
    minLength(1),
    maxLength(64),
    check((value) => !/[\r\n]/u.test(value)),
    check(
      (value) => Buffer.byteLength(value, "utf8") <= VOTE_SERVICE_NAME_MAX_BYTES,
      `Keep the service name within ${VOTE_SERVICE_NAME_MAX_BYTES} bytes.`
    )
  ),
  token: optional(pipe(string(), maxLength(1024))),
  publicKey: pipe(string(), trim(), maxLength(4096)),
});

export const saveVoteConfig = createServerFn({ method: "POST" })
  .validator((data: unknown) => parse(configSchema, data))
  .handler(async ({ data }) => {
    const session = await owner(data.projectId);
    await limit(`user:${session.user.id}`);
    await db.transaction(async (tx) => {
      await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, data.projectId))
        .for("update");

      const [old] = await tx
        .select()
        .from(serverVoteConfig)
        .where(eq(serverVoteConfig.projectId, data.projectId));

      const token = data.token
        ? encryptVoteToken(data.token)
        : (old?.token ?? null);

      if (data.host && (data.protocol === "v2" ? !token : !data.publicKey)) {
        throw new Error(
          "Configure the listener credentials or clear the host to disable rewards."
        );
      }

      const [project] = await tx
        .select({ ownerId: projects.ownerId, name: projects.name })
        .from(projects)
        .where(eq(projects.id, data.projectId));

      if (project?.ownerId && project.ownerId !== session.user.id) {
        await tx.insert(userNotifications).values({
          userId: project.ownerId,
          projectId: data.projectId,
          title: "Voting settings updated",
          type: "server-voting-updated",
          message: `A staff member updated voting settings for "${project.name}". Review your server dashboard.`,
        });
      }

      const values = { ...data, token, updatedAt: new Date() };
      await tx.insert(serverVoteConfig).values(values).onConflictDoUpdate({
        target: serverVoteConfig.projectId,
        set: values,
      });
    });
  });

export const getVoteConfig = createServerFn({ method: "GET" })
  .validator((data: unknown) => parse(projectSchema, data))
  .handler(async ({ data }) => {
    await owner(data.projectId);

    const [config] = await db
      .select()
      .from(serverVoteConfig)
      .where(eq(serverVoteConfig.projectId, data.projectId));

    if (!config) {
      return null;
    }

    const { token, ...view } = config;

    return { ...view, hasToken: !!token };
  });

export const voteHistory = createServerFn({ method: "GET" })
  .validator((data: unknown) => parse(projectSchema, data))
  .handler(async ({ data }) => {
    await owner(data.projectId);

    return db
      .select({
        id: serverVotes.id,
        minecraftUsername: serverVotes.minecraftUsername,
        edition: serverVotes.edition,
        votedAt: serverVotes.votedAt,
        deliveryStatus: serverVotes.deliveryStatus,
        deliveryDetail: serverVotes.deliveryDetail,
      })
      .from(serverVotes)
      .where(eq(serverVotes.projectId, data.projectId))
      .orderBy(desc(serverVotes.votedAt))
      .limit(50);
  });

export const voteStats = createServerFn({ method: "GET" })
  .validator((data: unknown) => parse(projectSchema, data))
  .handler(async ({ data }) => {
    await owner(data.projectId);

    return Promise.all(
      VOTE_TIMEFRAMES.map(async (timeframe) => {
        const window = timeframeWindowMs(timeframe);

        const [row] = await db
          .select({ total: count() })
          .from(serverVotes)
          .where(
            and(
              eq(serverVotes.projectId, data.projectId),
              Number.isFinite(window)
                ? gt(serverVotes.votedAt, new Date(Date.now() - window))
                : undefined
            )
          );

        return { timeframe, total: row?.total ?? 0 };
      })
    );
  });

export const testVoteConnection = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    parse(object({ ...projectSchema.entries, ...playerSchema.entries }), data)
  )
  .handler(async ({ data }) => {
    const session = await owner(data.projectId);
    await limit(`test:${session.user.id}`);

    const [config] = await db
      .select()
      .from(serverVoteConfig)
      .where(eq(serverVoteConfig.projectId, data.projectId));

    if (!config?.host) {
      throw new Error("Save a Votifier host first.");
    }

    if (!/^[A-Za-z0-9_. ]{1,16}$/u.test(data.minecraftUsername)) {
      throw new Error("Invalid test player name.");
    }

    return sendVoteNotification(
      config.host,
      config.port,
      config.protocol,
      {
        serviceName: config.serviceName || "VoxelVein",
        username: data.minecraftUsername,
        address: "0.0.0.0",
        timestamp: Date.now(),
      },
      deliveryCredentials(config)
    );
  });

export const votingLeaderboard = createServerFn({ method: "GET" })
  .validator((data: unknown) =>
    parse(object({ timeframe: picklist(VOTE_TIMEFRAMES) }), data)
  )
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();

    const ip = getForwardedClientIp(
      headers,
      process.env.TRUST_PROXY === "true"
    );

    if (
      await consumeServerLimit(
        "voting-leaderboard",
        `ip:${ip ?? "unknown"}`,
        RATE_LIMITS.read
      )
    ) {
      throw new Error(RATE_LIMIT_MESSAGE);
    }

    const window = timeframeWindowMs(data.timeframe);

    const votes = db
      .select({ projectId: serverVotes.projectId, total: count().as("total") })
      .from(serverVotes)
      .where(
        Number.isFinite(window)
          ? gt(serverVotes.votedAt, new Date(Date.now() - window))
          : undefined
      )
      .groupBy(serverVotes.projectId)
      .as("votes");

    return db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        icon: projectImages.id,
        totalVotes: sql<number>`coalesce(${votes.total},0)::integer`,
      })
      .from(projects)
      .innerJoin(
        serverVoteConfig,
        and(
          eq(serverVoteConfig.projectId, projects.id),
          eq(serverVoteConfig.votingEnabled, true)
        )
      )
      .leftJoin(votes, eq(votes.projectId, projects.id))
      .leftJoin(
        projectImages,
        and(
          eq(projectImages.projectId, projects.id),
          eq(projectImages.kind, "icon")
        )
      )
      .where(
        and(
          eq(projects.type, "server"),
          eq(projects.status, "published"),
          eq(projects.pendingDeletion, false)
        )
      )
      .orderBy(sql`coalesce(${votes.total},0) desc`, projects.name, projects.id)
      .limit(50);
  });
