import { describe, expect, it } from "vitest";

import { getForwardedClientIp, readTrustProxy } from "@/lib/client-key";

const headersWith = (forwarded: string) =>
  new Headers({ "x-forwarded-for": forwarded });

describe(readTrustProxy, () => {
  it("parses explicit values", () => {
    expect(readTrustProxy("true", true)).toBeTruthy();
    expect(readTrustProxy("false", true)).toBeFalsy();
  });

  it("defaults to false outside production", () => {
    expect(readTrustProxy(undefined, false)).toBeFalsy();
    expect(readTrustProxy("yes", false)).toBeFalsy();
  });

  it("throws in production when unset or invalid", () => {
    expect(() => readTrustProxy(undefined, true)).toThrow(/TRUST_PROXY/u);
    expect(() => readTrustProxy("1", true)).toThrow(/TRUST_PROXY/u);
  });
});

describe(getForwardedClientIp, () => {
  it("ignores the header when the proxy is not trusted", () => {
    expect(getForwardedClientIp(headersWith("203.0.113.7"), false)).toBeNull();
  });

  it("uses the entry appended by the proxy, not client-supplied ones", () => {
    expect(
      getForwardedClientIp(headersWith("198.51.100.1, 203.0.113.7"), true)
    ).toBe("203.0.113.7");
  });

  it("returns null when the header is missing or empty", () => {
    expect(getForwardedClientIp(new Headers(), true)).toBeNull();
    expect(getForwardedClientIp(headersWith(" "), true)).toBeNull();
  });
});
