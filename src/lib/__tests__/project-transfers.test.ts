import { describe, expect, it } from "vitest";

import {
  isTransferExpired,
  isTransferStatus,
  PROJECT_TRANSFER_EXPIRY_MS,
  PROJECT_TRANSFER_STATUSES,
  transferExpiresAt,
} from "@/lib/project-transfers";

const CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

describe(transferExpiresAt, () => {
  it("gives the recipient exactly seven days", () => {
    const expiresAt = transferExpiresAt(CREATED_AT);

    expect(expiresAt.toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(expiresAt.getTime() - CREATED_AT.getTime()).toBe(
      PROJECT_TRANSFER_EXPIRY_MS
    );
  });

  it("leaves the creation instant untouched", () => {
    const createdAt = new Date(CREATED_AT);
    const expiresAt = transferExpiresAt(createdAt);

    expect(createdAt.toISOString()).toBe(CREATED_AT.toISOString());
    expect(expiresAt).not.toBe(createdAt);
  });
});

describe(isTransferExpired, () => {
  const expiresAt = new Date("2026-01-08T00:00:00.000Z");

  it("stays answerable a millisecond before the deadline", () => {
    expect(
      isTransferExpired(expiresAt, new Date(expiresAt.getTime() - 1))
    ).toBeFalsy();
  });

  it("expires at the deadline and stays expired after it", () => {
    expect(isTransferExpired(expiresAt, expiresAt)).toBeTruthy();
    expect(
      isTransferExpired(expiresAt, new Date(expiresAt.getTime() + 1))
    ).toBeTruthy();
  });
});

describe(isTransferStatus, () => {
  it("recognises the stored statuses and rejects anything else", () => {
    for (const status of PROJECT_TRANSFER_STATUSES) {
      expect(isTransferStatus(status)).toBeTruthy();
    }

    expect(isTransferStatus("expired")).toBeFalsy();
    expect(isTransferStatus(" pending")).toBeFalsy();
    expect(isTransferStatus(undefined)).toBeFalsy();
  });
});
