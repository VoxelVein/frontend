import { createHash } from "node:crypto";
import type { Readable } from "node:stream";

import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import {
  deleteObjects,
  getDownloadUrl,
  STORAGE_ERROR,
  StorageError,
  uploadStream,
} from "@/lib/storage";
import type { StorageConfig } from "@/lib/storage";

const { abortMock } = vi.hoisted(() => ({
  abortMock: vi.fn<() => Promise<void>>(async () => {}),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The storage module reads env at import; tests pass an explicit config instead.
vi.mock("../../../env.config", () => ({ default: {} }));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Replaces the network multipart upload with one that just drains the body, so hashing and limits can be tested offline.
vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: class {
    readonly body: Readable;

    constructor(options: { params: { Body: Readable } }) {
      this.body = options.params.Body;
    }

    abort = abortMock;

    async done() {
      // Drain the stream like a real upload would.
      await this.body.toArray();
      return {};
    }
  },
}));

const config: StorageConfig = {
  accessKeyId: "key",
  bucket: "bucket",
  endpoint: "http://storage.test",
  forcePathStyle: true,
  maxFileBytes: 10,
  publicUrl: null,
  quotaBytes: null,
  region: "auto",
  secretAccessKey: "secret",
};

const fakeClient = () => {
  const client = new S3Client({
    credentials: { accessKeyId: "key", secretAccessKey: "secret" },
    region: "auto",
  });
  const send = vi.spyOn(client, "send").mockImplementation(async () => {});
  return { client, send };
};

const bodyOf = (text: string) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });

describe(uploadStream, () => {
  it("returns the size and both hashes of the streamed bytes", async () => {
    const { client } = fakeClient();

    const result = await uploadStream(
      {
        body: bodyOf("hello"),
        contentType: "application/java-archive",
        filename: "a.jar",
        key: "k",
      },
      config,
      client
    );

    expect(result).toStrictEqual({
      // Well-known SHA-1 of "hello".
      sha1: "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d",
      sha512: createHash("sha512").update("hello").digest("hex"),
      size: 5,
    });
  });

  it("aborts oversized uploads and removes the partial object", async () => {
    const { client, send } = fakeClient();

    const upload = uploadStream(
      {
        body: bodyOf("x".repeat(11)),
        contentType: "x",
        filename: "a.jar",
        key: "k",
      },
      config,
      client
    );

    await expect(upload).rejects.toStrictEqual(
      expect.objectContaining({ code: STORAGE_ERROR.fileTooLarge })
    );
    await expect(upload).rejects.toBeInstanceOf(StorageError);
    expect(abortMock).toHaveBeenCalledWith();
    const [[command]] = send.mock.calls;
    expect(command).toBeInstanceOf(DeleteObjectsCommand);
  });
});

describe("uploadStream with a per-upload limit", () => {
  it("stops at the lower of the file limit and maxBytes", async () => {
    const { client } = fakeClient();

    const upload = uploadStream(
      {
        body: bodyOf("x".repeat(6)),
        contentType: "x",
        filename: "a.jar",
        key: "k",
        maxBytes: 5,
      },
      config,
      client
    );

    await expect(upload).rejects.toStrictEqual(
      expect.objectContaining({ code: STORAGE_ERROR.fileTooLarge })
    );
  });
});

describe(getDownloadUrl, () => {
  it("builds public URLs with each path segment encoded", async () => {
    const url = await getDownloadUrl(
      "projects/p/v/f/My Mod+1.jar",
      { ...config, publicUrl: "https://cdn.example" },
      fakeClient().client
    );

    expect(url).toBe("https://cdn.example/projects/p/v/f/My%20Mod%2B1.jar");
  });
});

describe(deleteObjects, () => {
  it("deletes in batches of at most 1000 keys", async () => {
    const { client, send } = fakeClient();
    const keys = Array.from({ length: 1001 }, (_, index) => `k${index}`);

    await deleteObjects(keys, config, client);

    expect(send).toHaveBeenCalledTimes(2);
  });
});
