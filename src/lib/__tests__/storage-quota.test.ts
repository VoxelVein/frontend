import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DuplicateFilenameError,
  insertFileWithinQuota,
  isDuplicateFilenameViolation,
} from "@/lib/storage-quota";

/** The columns `insertFileWithinQuota` reads back for a version's files. */
interface ExistingFile {
  filename: string;
  id: string;
  platform: string | null;
  primary: boolean;
  size: number;
  storageKey: string;
}

interface InsertedFile {
  filename: string;
  id: string;
  platform: string | null;
  primary?: boolean;
  size: number;
  storageKey: string;
  versionId: string;
}

interface FakeDbState {
  deletedCount: number;
  existing: ExistingFile[];
  insertError: Error | null;
  inserted: InsertedFile[];
}

const { state } = vi.hoisted(() => {
  const initial: FakeDbState = {
    deletedCount: 0,
    existing: [],
    insertError: null,
    inserted: [],
  };

  return { state: initial };
});

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Replaces Postgres with an in-memory transaction so the insert rules can be tested offline.
vi.mock("@/db", () => {
  const tx = {
    delete: () => ({
      where: () => {
        state.deletedCount += 1;

        return Promise.resolve();
      },
    }),
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
  platform: null,
  sha1: "sha1",
  sha512: "sha512",
  size: 10,
  storageKey: "projects/p/v/f/mod-1.0.jar",
  versionId: "00000000-0000-4000-8000-000000000002",
};

const existingFile = (overrides: Partial<ExistingFile> = {}): ExistingFile => ({
  filename: "other.jar",
  id: "00000000-0000-4000-8000-000000000003",
  platform: null,
  primary: false,
  size: 5,
  storageKey: "projects/p/v/f/other.jar",
  ...overrides,
});

const pgError = (constraint: string) =>
  Object.assign(new Error("duplicate key value"), {
    code: "23505",
    constraint,
  });

describe(insertFileWithinQuota, () => {
  beforeEach(() => {
    state.deletedCount = 0;
    state.existing = [];
    state.insertError = null;
    state.inserted = [];
  });

  it("makes the first file of a version primary", async () => {
    await expect(insertFileWithinQuota(file, null)).resolves.toStrictEqual({
      primary: true,
      replacedStorageKey: null,
    });
    expect(state.inserted[0]).toMatchObject({ primary: true });
  });

  it("does not make later files primary", async () => {
    state.existing = [existingFile()];
    await expect(insertFileWithinQuota(file, null)).resolves.toStrictEqual({
      primary: false,
      replacedStorageKey: null,
    });
  });

  it("rejects a filename the version already has", async () => {
    state.existing = [existingFile({ filename: file.filename })];
    await expect(insertFileWithinQuota(file, null)).rejects.toBeInstanceOf(
      DuplicateFilenameError
    );
    expect(state.inserted).toHaveLength(0);
    expect(state.deletedCount).toBe(0);
  });

  it("replaces the platform file it supersedes and returns its storage key", async () => {
    const replacedKey = "projects/p/v/f/fabric/old.jar";
    state.existing = [
      existingFile({
        filename: file.filename,
        platform: "fabric",
        primary: true,
        storageKey: replacedKey,
      }),
    ];

    await expect(
      insertFileWithinQuota({ ...file, platform: "fabric" }, null)
    ).resolves.toStrictEqual({
      primary: true,
      replacedStorageKey: replacedKey,
    });
    expect(state.deletedCount).toBe(1);
    expect(state.inserted[0]).toMatchObject({
      filename: file.filename,
      platform: "fabric",
      primary: true,
    });
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
