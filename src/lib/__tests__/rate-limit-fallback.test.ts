import { describe, expect, it } from "vitest";

import { consumeRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

/**
 * The outage path, against the real client.
 *
 * No mocking here on purpose. `VALKEY_URL` is unset in this file's
 * environment, so `getValkey` points at a loopback default with nothing
 * listening — which is exactly the production scenario worth covering, reached
 * without a stub that could drift from the real failure. In CI, where something
 * *is* listening on 6379, these cases are skipped rather than silently
 * asserting nothing.
 */

const storeIsReachable = await (async () => {
  try {
    const { getValkey } = await import("@/lib/valkey");
    const valkey = await getValkey();
    return valkey.isReady;
  } catch {
    return false;
  }
})();

const describeWhenDown = storeIsReachable ? describe.skip : describe;

describeWhenDown("when Valkey is unreachable", () => {
  it("allows the request", async () => {
    // Failing open is deliberate. A limiter that takes the site down when its
    // store is down is a worse outage than the abuse it prevents, so the
    // request proceeds with the full budget untouched.
    const result = await consumeRateLimit("read", "outage", {
      limit: 5,
      windowMs: 60_000,
    });

    expect(result.limited).toBeFalsy();
    expect(result.remaining).toBe(5);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it("rejects promptly rather than leaving the request pending", async () => {
    // Covers the bounded connect, the disabled reconnect, and the circuit
    // breaker together: all three exist so that an unreachable store shows up
    // as one rejected call rather than as every subsequent request paying for a
    // connection that is going to be refused.
    //
    // node-redis retries a refused connection with backoff by default, which
    // would leave a request waiting behind it.
    const started = Date.now();
    await consumeRateLimit("read", "outage-slow", {
      limit: 5,
      windowMs: 60_000,
    });
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("the 429 response", () => {
  it("answers 429 with a Retry-After the client can act on", async () => {
    const response = rateLimitedResponse(42);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    await expect(response.json()).resolves.toStrictEqual({
      error: "Too many requests. Try again shortly.",
    });
  });
});
