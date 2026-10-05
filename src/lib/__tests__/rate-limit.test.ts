import { beforeAll, describe, expect, it } from "vitest";

import { consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Runs against a real Valkey, not a mock: the increment-and-expire race the
 * Lua script closes only shows up against a real server, and `eval` is the one
 * part of this path a fake would have to reproduce exactly.
 *
 * Point VALKEY_URL at a scratch instance. Skipped when it is unset so the
 * ordinary suite does not need a server running.
 */
const URL = process.env.VALKEY_TEST_URL;

// `describe.runIf` reads the condition directly instead of resolving a
// `describe` alias first. An alias hides the suite from static analysis, which
// is what made `vitest(consistent-test-it)` misread the `it` calls inside it.
describe.runIf(Boolean(URL))("consumeRateLimit against a real Valkey", () => {
  beforeAll(() => {
    // The client reads the URL lazily on its first connect, so pointing it at
    // the scratch instance here is early enough.
    process.env.VALKEY_URL = URL;
  });

  it("allows requests up to the limit and refuses the next one", async () => {
    const identity = `test-allow-${crypto.randomUUID()}`;
    const limit = { limit: 3, windowMs: 60_000 };

    const results = [];
    for (let index = 0; index < 4; index += 1) {
      // Sequential on purpose: the point is the running count.
      results.push(
        // oxlint-disable-next-line no-await-in-loop -- Requests must be sequential to assert a running counter
        await consumeRateLimit("test", identity, limit)
      );
    }

    expect(results.map((result) => result.limited)).toStrictEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(results.map((result) => result.remaining)).toStrictEqual([
      2, 1, 0, 0,
    ]);
  });

  it("sets an expiry on the bucket so it does not count forever", async () => {
    const identity = `test-ttl-${crypto.randomUUID()}`;
    await consumeRateLimit("test", identity, { limit: 1, windowMs: 60_000 });
    const { getValkey } = await import("@/lib/valkey");
    const valkey = await getValkey();
    const ttl = await valkey.ttl(`ratelimit:test:${identity}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  it("keeps buckets separate", async () => {
    const identity = `test-split-${crypto.randomUUID()}`;
    const limit = { limit: 1, windowMs: 60_000 };
    await consumeRateLimit("alpha", identity, limit);
    const other = await consumeRateLimit("beta", identity, limit);
    expect(other.limited).toBeFalsy();
  });

  it("keys on the identity, so two clients do not share a counter", async () => {
    const limit = { limit: 1, windowMs: 60_000 };
    const a = `test-a-${crypto.randomUUID()}`;
    const b = `test-b-${crypto.randomUUID()}`;
    await consumeRateLimit("test", a, limit);
    const second = await consumeRateLimit("test", b, limit);
    expect(second.limited).toBeFalsy();
  });

  it("refuses every request when the limit is zero", async () => {
    // The real behaviour of a zero budget against a reachable store. Worth
    // pinning because it is the shape a misconfigured limit would take, and it
    // must fail closed rather than quietly allowing traffic.
    const result = await consumeRateLimit(
      "test",
      `test-zero-${crypto.randomUUID()}`,
      { limit: 0, windowMs: 60_000 }
    );
    expect(result.limited).toBeTruthy();
    expect(result.remaining).toBe(0);
  });
});

describe("the limit table", () => {
  it("gives read more headroom than write, and auth the least", () => {
    expect(RATE_LIMITS.read.limit).toBeGreaterThan(RATE_LIMITS.write.limit);
    expect(RATE_LIMITS.write.limit).toBeGreaterThan(RATE_LIMITS.auth.limit);
  });
});
