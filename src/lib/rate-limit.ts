import { getValkey } from "@/lib/valkey";

/**
 * Fixed-window rate limiting, shared across replicas through Valkey.
 *
 * Counters live in Valkey rather than in process memory because both the web
 * app and the API enforce limits, and because a per-process counter would be
 * enforced separately by every replica — multiplying the real limit by the
 * number of them.
 */

/**
 * Increment, and set the expiry only on the first hit.
 *
 * A Lua script so the read-modify-write is atomic. Doing `INCR` then `EXPIRE`
 * as two commands leaves a window where a crash between them leaves a key with
 * no TTL, and that key then counts forever.
 */
const INCREMENT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return count
`;

export interface RateLimit {
  /** Requests allowed in one window. */
  limit: number;
  /** Window length. */
  windowMs: number;
}

export interface RateLimitResult {
  /** Requests left in the current window. Never negative. */
  remaining: number;
  /** Whether the caller has used up the window. */
  limited: boolean;
  /** Seconds until the window resets, for a `Retry-After` header. */
  retryAfterSeconds: number;
}

/**
 * The budget for each kind of request.
 *
 * Deliberately coarse. The point is to stop a runaway client or a script, not
 * to enforce a product quota: a real user typing in the search box never comes
 * close to these numbers, while a loop over them does.
 */
export const RATE_LIMITS = {
  /** Sign-up, sign-in, and the Turnstile-protected forms. */
  auth: { limit: 10, windowMs: 60_000 },
  /** File downloads. Generous: a pack install pulls several files at once. */
  download: { limit: 120, windowMs: 60_000 },
  /** A public read that costs a database query: search, browse. */
  read: { limit: 120, windowMs: 60_000 },
  /** Opening an SSE stream. Reconnect storms after a deploy are the case this catches. */
  sseConnect: { limit: 30, windowMs: 60_000 },
  /** Avatar and project image uploads. Per user, so bytes are bounded. */
  upload: { limit: 20, windowMs: 60_000 },
  /** Anything that writes content: posts, projects, reviews. */
  write: { limit: 30, windowMs: 60_000 },
} as const satisfies Record<string, RateLimit>;

/**
 * Counts one request against a bucket and reports whether it is over.
 *
 * `identity` should be the user id when there is a session and the client IP
 * otherwise. Keying on the user id where possible means a shared NAT does not
 * throttle everyone behind it, and it cannot be rotated by reconnecting.
 *
 * **Fails open.** If Valkey is unreachable the request is allowed, because a
 * limiter that takes the site down when its cache is down is a worse outage
 * than the abuse it prevents. The failure is logged rather than silent.
 *
 * The store cannot leave a request hanging: `getValkey` bounds its connect and
 * does not retry, so an outage surfaces as a rejected promise that lands in the
 * catch below rather than as a pending one.
 */
/**
 * How long the limiter stops trying after Valkey fails.
 *
 * Without this, every request during an outage builds a fresh client and waits
 * on a connection that is going to be refused, so one broken dependency would
 * cost every request on the site its latency. That is the opposite of what the
 * limiter is for. After the cooldown it tries again, so recovery needs no
 * restart.
 */
const BREAKER_COOLDOWN_MS = 10_000;

let failuresUntil = 0;

const breakerIsOpen = (): boolean => Date.now() < failuresUntil;

export const consumeRateLimit = async (
  bucket: string,
  identity: string,
  { limit, windowMs }: RateLimit
): Promise<RateLimitResult> => {
  const allow: RateLimitResult = {
    limited: false,
    remaining: limit,
    retryAfterSeconds: 0,
  };

  if (breakerIsOpen()) {
    return allow;
  }

  try {
    const valkey = await getValkey();
    const windowSeconds = Math.ceil(windowMs / 1000);
    // The bucket is in the key, so one rule can be raised or lowered without
    // invalidating the others, and the two never share a counter.
    const key = `ratelimit:${bucket}:${identity}`;

    const count = Number(
      await valkey.eval(INCREMENT_SCRIPT, {
        arguments: [String(windowSeconds)],
        keys: [key],
      })
    );

    const ttl = await valkey.ttl(key);
    // One good call closes the breaker again, so the limiter recovers on its
    // own the moment Valkey does.
    failuresUntil = 0;
    return {
      limited: count > limit,
      remaining: Math.max(0, limit - count),
      // A key with no expiry reports -2; fall back to the full window rather
      // than sending a negative or zero Retry-After.
      retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (error) {
    failuresUntil = Date.now() + BREAKER_COOLDOWN_MS;
    console.error("Rate limit check failed, allowing the request", error);
    return allow;
  }
};

/** The 429 body, matching the shape the other API routes return. */
export const rateLimitedResponse = (retryAfterSeconds: number): Response =>
  Response.json(
    { error: "Too many requests. Try again shortly." },
    {
      headers: { "retry-after": String(retryAfterSeconds) },
      status: 429,
    }
  );
