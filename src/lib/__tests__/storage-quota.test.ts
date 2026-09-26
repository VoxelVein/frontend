import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DuplicateFilenameError,
  insertFileWithinQuota,
  isDuplicateFilenameViolation,
} from "@/lib/storage-quota";

interface InsertedFile {
  primary?: boolean;
}

interface FakeDbState {
  existing: { filename: string }[];
  insertError: Error | null;
  inserted: InsertedFile[];
}

const { state } = vi.hoisted(() => {
  const initial: FakeDbState = {
    existing: [],
    insertError: null,
    inserted: [],
  };
  return { state: initial };
});

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Replaces Postgres with an in-memory transaction so the insert rules can be tested offline.
vi.mock("@/db", () => {
  const tx = {
    execute: () => Promise.resolve(),
    insert: () => ({
      values: (values: InsertedFile) => {
        if (state.insertError) {
          return Promise.reject(state.insertError);
        }
        state.inserted.push(values);
        return Promise.resolve();
      },
    }),
    select: () => ({
      from: () => ({ where: () => Promise.resolve(state.existing) }),
    }),
  };
  return {
    db: {
      transaction: <T>(run: (executor: typeof tx) => Promise<T>) => run(tx),
    },
  };
});

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The storage module reads env at import; these tests never touch storage.
vi.mock("../../../env.config", () => ({ default: {} }));

const file = {
  filename: "mod-1.0.jar",
  id: "00000000-0000-4000-8000-000000000001",
  sha1: "sha1",
  sha512: "sha512",
  size: 10,
  storageKey: "projects/p/v/f/mod-1.0.jar",
  versionId: "00000000-0000-4000-8000-000000000002",
};

const pgError = (constraint: string) =>
  Object.assign(new Error("duplicate key value"), {
    code: "23505",
    constraint,
  });

describe(insertFileWithinQuota, () => {
  beforeEach(() => {
    state.existing = [];
    state.insertError = null;
    state.inserted = [];
  });

  it("makes the first file of a version primary", async () => {
    await expect(insertFileWithinQuota(file, null)).resolves.toStrictEqual({
      primary: true,
    });
    expect(state.inserted[0]).toMatchObject({ primary: true });
  });

  it("does not make later files primary", async () => {
    state.existing = [{ filename: "other.jar" }];
    await expect(insertFileWithinQuota(file, null)).resolves.toStrictEqual({
      primary: false,
    });
  });

  it("rejects a filename the version already has", async () => {
    state.existing = [{ filename: file.filename }];
    await expect(insertFileWithinQuota(file, null)).rejects.toBeInstanceOf(
      DuplicateFilenameError
    );
    expect(state.inserted).toHaveLength(0);
  });

  it("maps a wrapped filename unique violation to DuplicateFilenameError", async () => {
    state.insertError = new Error("Failed query", {
      cause: pgError("project_files_versionId_filename_uidx"),
    });
    await expect(insertFileWithinQuota(file, null)).rejects.toBeInstanceOf(
      DuplicateFilenameError
    );
  });

  it("rethrows other unique violations unchanged", async () => {
    const error = pgError("project_files_storage_key_unique");
    state.insertError = error;
    await expect(insertFileWithinQuota(file, null)).rejects.toBe(error);
  });
});

describe(isDuplicateFilenameViolation, () => {
  it("ignores errors that are not Postgres unique violations", () => {
    expect(isDuplicateFilenameViolation(new Error("boom"))).toBeFalsy();
    expect(isDuplicateFilenameViolation("23505")).toBeFalsy();
  });
});
