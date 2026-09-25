import { describe, expect, it, vi } from "vitest";

import {
  getTurnstileConfigProblems,
  parseHostnames,
  TURNSTILE_FAILURE,
  verifyTurnstileToken,
} from "@/lib/turnstile";
import type { TurnstileConfig } from "@/lib/turnstile";

const REAL_SECRET = "0x4AAAAAAAreal-secret-value";
const TESTING_SECRET = "1x0000000000000000000000000000000AA";

const productionConfig: TurnstileConfig = {
  hostnames: new Set(["voxelvein.example"]),
  isProduction: true,
  secret: REAL_SECRET,
};

const developmentConfig: TurnstileConfig = {
  hostnames: new Set(["localhost", "127.0.0.1"]),
  isProduction: false,
  secret: TESTING_SECRET,
};

// Loosely typed on purpose: fixtures include malformed siteverify responses.
interface SiteverifyFixture {
  action?: string;
  "error-codes"?: string[];
  hostname?: string;
  metadata?: { result_with_testing_key?: boolean };
  success?: boolean;
  unexpected?: string;
}

const siteverifyReturning = (body: SiteverifyFixture, status = 200) =>
  vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }));

describe(parseHostnames, () => {
  it("splits, trims, and drops empty entries", () => {
    expect(parseHostnames(" a.example , ,b.example")).toStrictEqual(
      new Set(["a.example", "b.example"])
    );
  });

  it("returns an empty set when unset", () => {
    expect(parseHostnames().size).toBe(0);
  });
});

describe(getTurnstileConfigProblems, () => {
  it("accepts a real production config", () => {
    expect(getTurnstileConfigProblems(productionConfig)).toStrictEqual([]);
  });

  it("accepts testing keys with local hostnames outside production", () => {
    expect(getTurnstileConfigProblems(developmentConfig)).toStrictEqual([]);
  });

  it("rejects a missing secret and hostnames", () => {
    expect(
      getTurnstileConfigProblems({
        hostnames: new Set(),
        isProduction: false,
        secret: null,
      })
    ).toHaveLength(2);
  });

  it("rejects testing secrets and local hostnames in production", () => {
    const problems = getTurnstileConfigProblems({
      hostnames: new Set(["voxelvein.example", "localhost"]),
      isProduction: true,
      secret: TESTING_SECRET,
    });

    expect(problems).toStrictEqual([
      "TURNSTILE_SECRET is a Cloudflare testing secret.",
      "TURNSTILE_HOSTNAMES must not include localhost.",
    ]);
  });
});

describe(verifyTurnstileToken, () => {
  it("accepts a token with the expected action and hostname", async () => {
    const fetchMock = siteverifyReturning({
      action: "login",
      hostname: "voxelvein.example",
      success: true,
    });

    const result = await verifyTurnstileToken(
      { expectedAction: "login", remoteIp: "203.0.113.7", token: "token" },
      productionConfig,
      fetchMock
    );

    expect(result).toStrictEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = new URLSearchParams(String(init?.body));
    expect(body.get("secret")).toBe(REAL_SECRET);
    expect(body.get("response")).toBe("token");
    expect(body.get("remoteip")).toBe("203.0.113.7");
  });

  it("rejects a token issued for a different action", async () => {
    const result = await verifyTurnstileToken(
      { expectedAction: "signup", token: "token" },
      productionConfig,
      siteverifyReturning({
        action: "login",
        hostname: "voxelvein.example",
        success: true,
      })
    );

    expect(result).toStrictEqual({
      ok: false,
      reason: TURNSTILE_FAILURE.rejected,
    });
  });

  it("rejects a token issued on an unapproved hostname", async () => {
    const result = await verifyTurnstileToken(
      { expectedAction: "login", token: "token" },
      productionConfig,
      siteverifyReturning({
        action: "login",
        hostname: "evil.example",
        success: true,
      })
    );

    expect(result).toStrictEqual({
      ok: false,
      reason: TURNSTILE_FAILURE.rejected,
    });
  });

  it("rejects a failed or replayed token", async () => {
    const result = await verifyTurnstileToken(
      { expectedAction: "login", token: "token" },
      productionConfig,
      siteverifyReturning({
        "error-codes": ["timeout-or-duplicate"],
        success: false,
      })
    );

    expect(result).toStrictEqual({
      ok: false,
      reason: TURNSTILE_FAILURE.rejected,
    });
  });

  it("rejects missing and oversized tokens without calling siteverify", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    for (const token of [null, "", "x".repeat(2049)]) {
      // oxlint-disable-next-line no-await-in-loop -- Each case is checked in turn against the same mock.
      const result = await verifyTurnstileToken(
        { expectedAction: "login", token },
        productionConfig,
        fetchMock
      );
      expect(result).toStrictEqual({
        ok: false,
        reason: TURNSTILE_FAILURE.missingToken,
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when siteverify is unreachable or malformed", async () => {
    const unreachable = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("fetch failed"));

    for (const fetchMock of [
      unreachable,
      siteverifyReturning({ success: true }, 500),
      siteverifyReturning({ unexpected: "shape" }),
    ]) {
      // oxlint-disable-next-line no-await-in-loop -- Each case is checked in turn.
      const result = await verifyTurnstileToken(
        { expectedAction: "login", token: "token" },
        productionConfig,
        fetchMock
      );
      expect(result).toStrictEqual({
        ok: false,
        reason: TURNSTILE_FAILURE.siteverifyUnavailable,
      });
    }
  });

  it("fails closed when Turnstile is not configured", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    const result = await verifyTurnstileToken(
      { expectedAction: "login", token: "token" },
      { hostnames: new Set(), isProduction: true, secret: null },
      fetchMock
    );

    expect(result).toStrictEqual({
      ok: false,
      reason: TURNSTILE_FAILURE.notConfigured,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts testing-key results only outside production", async () => {
    const testingResult = {
      hostname: "example.com",
      metadata: { result_with_testing_key: true },
      success: true,
    };

    const inDevelopment = await verifyTurnstileToken(
      { expectedAction: "login", token: "XXXX.DUMMY.TOKEN.XXXX" },
      developmentConfig,
      siteverifyReturning(testingResult)
    );
    const inProduction = await verifyTurnstileToken(
      { expectedAction: "login", token: "XXXX.DUMMY.TOKEN.XXXX" },
      productionConfig,
      siteverifyReturning(testingResult)
    );

    expect(inDevelopment).toStrictEqual({ ok: true });
    expect(inProduction).toStrictEqual({
      ok: false,
      reason: TURNSTILE_FAILURE.rejected,
    });
  });
});
