import { createServerFn } from "@tanstack/react-start";
import { and, eq, inArray } from "drizzle-orm";
import {
  array,
  boolean,
  maxLength,
  nullish,
  number,
  object,
  optional,
  parse,
  pipe,
  string,
  uuid,
} from "valibot";

import { db } from "@/db";
import { projectServers, projects } from "@/db/schema";
import { formatServerAddress } from "@/lib/projects";

const statusInputSchema = object({
  projectIds: pipe(array(pipe(string(), uuid())), maxLength(12)),
});
const responseSchema = object({
  online: boolean(),
  players: optional(
    object({ online: nullish(number()), max: nullish(number()) })
  ),
});

export interface MinecraftServerStatus {
  maxPlayers: number | null;
  online: boolean | null;
  onlinePlayers: number | null;
}

const UNKNOWN_STATUS: MinecraftServerStatus = {
  maxPlayers: null,
  online: null,
  onlinePlayers: null,
};

const CACHE_TIME_MS = 60_000;
const statusCache = new Map<
  string,
  { expiresAt: number; status: MinecraftServerStatus }
>();
const requests = new Map<
  string,
  Promise<Record<string, MinecraftServerStatus>>
>();

const queryEdition = async (
  edition: "bedrock" | "java",
  address: string
): Promise<MinecraftServerStatus | null> => {
  try {
    const url = new URL(
      `https://api.mcstatus.io/v2/status/${edition}/${encodeURIComponent(address)}`
    );
    url.searchParams.set("timeout", "1.2");
    if (edition === "java") {
      url.searchParams.set("query", "false");
    }
    const response = await fetch(url, {
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();
    const status = parse(responseSchema, data);
    if (!status.online) {
      return { ...UNKNOWN_STATUS, online: false };
    }
    return {
      maxPlayers: status.players?.max ?? null,
      online: true,
      onlinePlayers: status.players?.online ?? null,
    };
  } catch {
    return null;
  }
};

const loadStatuses = async (
  projectIds: string[]
): Promise<Record<string, MinecraftServerStatus>> => {
  const servers = await db
    .select({
      address: projectServers.address,
      port: projectServers.port,
      projectId: projectServers.projectId,
    })
    .from(projectServers)
    .innerJoin(projects, eq(projects.id, projectServers.projectId))
    .where(
      and(
        inArray(projectServers.projectId, projectIds),
        eq(projects.type, "server"),
        eq(projects.status, "published"),
        eq(projects.pendingDeletion, false)
      )
    );

  const statuses = await Promise.all(
    servers.map(async (server) => {
      try {
        const javaAddress = formatServerAddress(server.address, server.port);
        const javaStatus = await queryEdition("java", javaAddress);
        if (javaStatus?.online === true) {
          return [server.projectId, javaStatus] as const;
        }

        // Listings do not currently declare an edition. If Java is offline,
        // try Bedrock's status protocol as well; its default port is 19132.
        const bedrockPort = server.port ?? 19_132;
        const bedrockAddress = server.address.includes(":")
          ? `[${server.address}]:${bedrockPort}`
          : `${server.address}:${bedrockPort}`;
        const bedrockStatus = await queryEdition("bedrock", bedrockAddress);
        if (bedrockStatus?.online === true) {
          return [server.projectId, bedrockStatus] as const;
        }
        return [
          server.projectId,
          javaStatus?.online === false || bedrockStatus?.online === false
            ? { ...UNKNOWN_STATUS, online: false }
            : UNKNOWN_STATUS,
        ] as const;
      } catch {
        return [server.projectId, UNKNOWN_STATUS] as const;
      }
    })
  );

  return Object.fromEntries(statuses);
};

const getStatuses = async (
  projectIds: string[]
): Promise<Record<string, MinecraftServerStatus>> => {
  const now = Date.now();
  const statuses: Record<string, MinecraftServerStatus> = {};
  const missing: string[] = [];
  for (const projectId of projectIds) {
    const cached = statusCache.get(projectId);
    if (cached && cached.expiresAt > now) {
      statuses[projectId] = cached.status;
    } else {
      missing.push(projectId);
    }
  }
  if (missing.length === 0) {
    return statuses;
  }

  // oxlint-disable-next-line unicorn/no-array-sort -- The tsconfig target does not include ES2023 `toSorted`.
  const requestKey = [...missing].sort().join(":");
  let request = requests.get(requestKey);
  if (!request) {
    request = loadStatuses(missing).catch(() =>
      Object.fromEntries(missing.map((id) => [id, UNKNOWN_STATUS]))
    );
    requests.set(requestKey, request);
    void request.then((loaded) => {
      for (const [projectId, status] of Object.entries(loaded)) {
        if (statusCache.size >= 2000) {
          const oldest = statusCache.keys().next().value;
          if (oldest) {
            statusCache.delete(oldest);
          }
        }
        statusCache.set(projectId, {
          expiresAt: Date.now() + CACHE_TIME_MS,
          status,
        });
      }
      requests.delete(requestKey);
      return loaded;
    });
  }
  const loaded = await request;
  for (const projectId of missing) {
    statuses[projectId] = loaded[projectId] ?? UNKNOWN_STATUS;
  }
  return statuses;
};

export const getMinecraftServerStatuses = createServerFn({ method: "GET" })
  .validator((data: { projectIds: string[] }) => parse(statusInputSchema, data))
  .handler(({ data }) => getStatuses(data.projectIds));
