import { createClient } from "redis";
import type { RedisClientType } from "redis";

/**
 * Valkey, the Linux Foundation fork of Redis.
 *
 * The fork is wire-compatible, so this is the standard `redis` client talking
 * to a `valkey/valkey` server. Nothing here needs to know which it is, and the
 * same code works against a managed Redis if a deployment ever prefers one.
 *
 * Nothing is persisted: every key the app writes carries a TTL, so the store is
 * safe to treat as disposable and the server runs with persistence disabled.
 */

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

/**
 * The connection URL, or an error explaining what is missing.
 *
 * Production requires it explicitly rather than assuming localhost, for the
 * same reason `readTrustProxy` does: a deploy that silently falls back to a
 * loopback default is a deploy with no shared counters, which looks like
 * working rate limits while enforcing nothing.
 */
const readUrl = (): string => {
  const url = process.env.VALKEY_URL;
  if (url) {
    return url;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "VALKEY_URL must be set in production (redis://host:port). Rate-limit counters are shared through it, and without it every replica would enforce its own limit."
    );
  }
  return "redis://127.0.0.1:6379";
};

/**
 * The shared client, connecting on first use.
 *
 * Concurrent callers during boot share one `connect()` promise; without it
 * every request in the first moments of a cold start would open its own
 * connection.
 *
 * Errors are logged and swallowed here rather than thrown: the client
 * reconnects on its own, and a limiter must not take the request down with it.
 * The command itself is what fails, and each caller decides what that means.
 */
export const getValkey = async (): Promise<RedisClientType> => {
  if (client?.isReady) {
    return client;
  }
  if (connecting) {
    return connecting;
  }

  const created = createClient({
    url: readUrl(),
    socket: {
      // Bounded, and no reconnect: the default retries a refused connection
      // with backoff indefinitely, which would leave the caller — and the
      // request waiting on it — pending long past any useful answer. A failed
      // connect throws into the caller instead, and the next request builds a
      // fresh client, so an outage self-heals.
      connectTimeout: 2000,
      reconnectStrategy: false,
    },
  });
  created.on("error", (error: Error) => {
    // Without a listener node-redis throws on every reconnect attempt and
    // crashes the process.
    console.error("Valkey connection error", error);
  });

  const pending = (async () => {
    try {
      await created.connect();
    } catch (error) {
      // A refused connection has to clear the in-flight promise, or every
      // later request awaits a promise that already rejected.
      created.destroy();
      throw error;
    }
    client = created;
    return created;
  })();

  connecting = pending;
  try {
    return await pending;
  } finally {
    connecting = null;
  }
};

/** Whether a client is currently connected, for startup reporting. */
export const isValkeyReady = (): boolean => client?.isReady ?? false;
