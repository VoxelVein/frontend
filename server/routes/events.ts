import { Elysia, sse } from "elysia";

import "../env";
import { getForwardedClientIp, readTrustProxy } from "../../src/lib/client-key";
import { AsyncQueue, events } from "../lib/events";
import type { ModEvent } from "../lib/events";

const DEFAULT_MAX_CONNECTIONS = 500;
const DEFAULT_MAX_CONNECTIONS_PER_IP = 5;

const readPositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const MAX_CONNECTIONS = readPositiveInt(
  process.env.SSE_MAX_CONNECTIONS,
  DEFAULT_MAX_CONNECTIONS
);
const MAX_CONNECTIONS_PER_IP = readPositiveInt(
  process.env.SSE_MAX_CONNECTIONS_PER_IP,
  DEFAULT_MAX_CONNECTIONS_PER_IP
);
// The Node adapter does not expose the socket address (server.requestIP is
// Bun-only), so per-client limits rely on the proxy's X-Forwarded-For header.
// It is only trusted when TRUST_PROXY is set, because clients can forge it
// otherwise. Production must choose explicitly so a missing setting cannot
// quietly leave one client able to take every slot.
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const TRUST_PROXY = readTrustProxy(process.env.TRUST_PROXY, IS_PRODUCTION);

if (IS_PRODUCTION && !TRUST_PROXY) {
  console.warn(
    "TRUST_PROXY is not enabled: SSE streams are only capped globally, so a single client can use every slot."
  );
}

let openConnections = 0;
const connectionsByClient = new Map<string, number>();

const acquireSlot = (clientKey: string | null): boolean => {
  if (openConnections >= MAX_CONNECTIONS) {
    return false;
  }
  if (clientKey !== null) {
    const current = connectionsByClient.get(clientKey) ?? 0;
    if (current >= MAX_CONNECTIONS_PER_IP) {
      return false;
    }
    connectionsByClient.set(clientKey, current + 1);
  }
  openConnections += 1;
  return true;
};

const releaseSlot = (clientKey: string | null): void => {
  openConnections -= 1;
  if (clientKey === null) {
    return;
  }
  const remaining = (connectionsByClient.get(clientKey) ?? 1) - 1;
  if (remaining > 0) {
    connectionsByClient.set(clientKey, remaining);
  } else {
    connectionsByClient.delete(clientKey);
  }
};

const streamModEvents = async function* streamModEvents(
  signal: AbortSignal,
  clientKey: string | null
) {
  const queue = new AsyncQueue<ModEvent>();
  const unsubscribe = events.subscribe((event) => queue.push(event));

  // A client disconnect never resumes the generator on its own, so the
  // pending queue.next() would hang forever and the subscriber and connection
  // slot would leak. Closing the queue on abort ends the loop below.
  const closeQueue = () => queue.close();
  signal.addEventListener("abort", closeQueue, { once: true });

  try {
    // Elysia awaits the first generator step before sending the response, so
    // yield a "connected" event immediately to open the stream.
    yield sse({ event: "connected", data: { message: "connected" } });

    while (true) {
      // oxlint-disable-next-line no-await-in-loop -- SSE events must be yielded in arrival order; parallelizing would reorder the stream.
      const event = await queue.next();
      if (!event) {
        break;
      }
      yield sse(event);
    }
  } finally {
    signal.removeEventListener("abort", closeQueue);
    unsubscribe();
    queue.close();
    releaseSlot(clientKey);
  }
};

export const eventsRoute = new Elysia().get("/api/events", ({ request }) => {
  const clientKey = getForwardedClientIp(request.headers, TRUST_PROXY);

  if (!acquireSlot(clientKey)) {
    return new Response("Too many event streams", {
      headers: { "Retry-After": "30" },
      status: 429,
    });
  }

  return streamModEvents(request.signal, clientKey);
});
