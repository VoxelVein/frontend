import { safeParse } from "valibot";
import { describe, expect, it } from "vitest";

import {
  formatServerAddress,
  isServerAddress,
  serverInputSchema,
} from "@/lib/projects";
import type { ServerInput } from "@/lib/projects";

const PROJECT_ID = "5f0c9a3e-2b1d-4c7e-9f6a-1b2c3d4e5f60";

const input = (overrides: Partial<ServerInput> = {}): ServerInput => ({
  address: "play.example.net",
  gameVersions: ["1.21"],
  modpackId: null,
  modpackRequired: false,
  port: null,
  projectId: PROJECT_ID,
  ...overrides,
});

describe(isServerAddress, () => {
  it("accepts hostnames and IP addresses", () => {
    for (const address of [
      "play.example.net",
      "mc-1.example.co.uk",
      "localhost",
      "203.0.113.7",
      "2001:db8::1",
    ]) {
      expect(isServerAddress(address)).toBeTruthy();
    }
  });

  it("rejects schemes, paths, ports, and spaces", () => {
    for (const address of [
      "https://play.example.net",
      "play.example.net/join",
      "play.example.net:25565",
      "play example.net",
      "-bad.example.net",
      "",
    ]) {
      expect(isServerAddress(address)).toBeFalsy();
    }
  });
});

describe("server join details", () => {
  it("normalizes the address", () => {
    const result = safeParse(
      serverInputSchema,
      input({ address: "  Play.Example.NET " })
    );
    expect(result.success && result.output.address).toBe("play.example.net");
  });

  it("requires a known game version", () => {
    expect(
      safeParse(serverInputSchema, input({ gameVersions: [] })).success
    ).toBeFalsy();
    expect(
      safeParse(serverInputSchema, input({ gameVersions: ["9.9.9"] })).success
    ).toBeFalsy();
  });

  it("keeps ports in range", () => {
    expect(
      safeParse(serverInputSchema, input({ port: 25_566 })).success
    ).toBeTruthy();
    expect(
      safeParse(serverInputSchema, input({ port: 0 })).success
    ).toBeFalsy();
    expect(
      safeParse(serverInputSchema, input({ port: 70_000 })).success
    ).toBeFalsy();
    expect(
      safeParse(serverInputSchema, input({ port: 1.5 })).success
    ).toBeFalsy();
  });
});

describe(formatServerAddress, () => {
  it("leaves out the default port", () => {
    expect(formatServerAddress("play.example.net", null)).toBe(
      "play.example.net"
    );
    expect(formatServerAddress("play.example.net", 25_565)).toBe(
      "play.example.net"
    );
  });

  it("appends other ports, bracketing IPv6", () => {
    expect(formatServerAddress("play.example.net", 25_566)).toBe(
      "play.example.net:25566"
    );
    expect(formatServerAddress("2001:db8::1", 25_566)).toBe(
      "[2001:db8::1]:25566"
    );
  });
});
