/* oxlint-disable sonarjs/no-hardcoded-ip -- Explicit public and reserved addresses exercise the SSRF policy. */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatCooldownRemaining,
  timeframeWindowMs,
  VOTE_COOLDOWN_MS,
} from "@/lib/server-voting";
import { isPublicVoteAddress } from "@/lib/votifier";
import { decryptVoteToken, encryptVoteToken } from "@/lib/voting-credentials";

describe("vote credentials", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("encrypts with a random nonce and authenticates ciphertext", () => {
    vi.stubEnv("VOTING_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    const encrypted = encryptVoteToken("private-token");
    expect(encrypted).not.toContain("private-token");
    expect(encryptVoteToken("private-token")).not.toBe(encrypted);
    expect(decryptVoteToken(encrypted)).toBe("private-token");
    const parts = encrypted.split(".");
    parts[2] = Buffer.from("tampered").toString("base64");
    expect(() => decryptVoteToken(parts.join("."))).toThrow(
      "Unsupported state or unable to authenticate data"
    );
  });

  it("refuses missing encryption keys", () => {
    vi.stubEnv("VOTING_ENCRYPTION_KEY", "");
    expect(() => encryptVoteToken("secret")).toThrow("VOTING_ENCRYPTION_KEY");
  });
});

describe("voting periods", () => {
  it("uses rolling 24 hour, 7 day and 30 day windows", () => {
    expect(timeframeWindowMs("daily")).toBe(VOTE_COOLDOWN_MS);
    expect(timeframeWindowMs("weekly")).toBe(7 * VOTE_COOLDOWN_MS);
    expect(timeframeWindowMs("monthly")).toBe(30 * VOTE_COOLDOWN_MS);
    expect(timeframeWindowMs("all-time")).toBe(Infinity);
  });

  it("expires exactly at the cooldown boundary", () => {
    expect(formatCooldownRemaining(0)).toBeNull();
    expect(formatCooldownRemaining(-1)).toBeNull();
    expect(formatCooldownRemaining(1)).toBe("less than 1m");
    expect(formatCooldownRemaining(VOTE_COOLDOWN_MS)).toBe("24h 0m");
  });
});

describe("Votifier destination protection", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "172.16.0.1",
    "100.64.0.1",
    "224.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "2001:db8::1",
    "2002:7f00:1::",
    // Start with "2" or "3" but sit outside 2000::/3 (first hextet < 0x2000).
    "2::1",
    "3a::1",
  ])("blocks %s", (address) =>
    expect(isPublicVoteAddress(address)).toBeFalsy()
  );

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "allows public %s",
    (address) => expect(isPublicVoteAddress(address)).toBeTruthy()
  );
});
