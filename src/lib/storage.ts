import { createHash } from "node:crypto";
import type { Hash } from "node:crypto";
import { Readable } from "node:stream";

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import env from "../../env.config";

const DEFAULT_MAX_FILE_BYTES = 100 * 1024 * 1024;
const PRESIGNED_DOWNLOAD_TTL_SECONDS = 300;
// Keys are content-addressed, so a stored object never changes.
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const DELETE_BATCH_SIZE = 1000;

export interface StorageConfig {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  forcePathStyle: boolean;
  maxFileBytes: number;
  publicUrl: string | null;
  region: string;
  secretAccessKey: string;
}

export interface UploadInput {
  body: AsyncIterable<Uint8Array>;
  contentType: string;
  filename: string;
  key: string;
}

export interface UploadResult {
  sha1: string;
  sha512: string;
  size: number;
}

export const STORAGE_ERROR = {
  fileTooLarge: "file-too-large",
  notConfigured: "not-configured",
} as const;

export type StorageErrorCode =
  (typeof STORAGE_ERROR)[keyof typeof STORAGE_ERROR];

export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

export const loadStorageConfig = (): StorageConfig => {
  const {
    STORAGE_ACCESS_KEY_ID: accessKeyId,
    STORAGE_BUCKET: bucket,
    STORAGE_ENDPOINT: endpoint,
    STORAGE_SECRET_ACCESS_KEY: secretAccessKey,
  } = env;

  if (!accessKeyId || !bucket || !endpoint || !secretAccessKey) {
    throw new StorageError(
      STORAGE_ERROR.notConfigured,
      "Object storage is not configured. Set the STORAGE_* variables (see docs/storage/object-storage.md)."
    );
  }

  return {
    accessKeyId,
    bucket,
    endpoint,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE === "true",
    maxFileBytes: env.STORAGE_MAX_FILE_BYTES
      ? Number(env.STORAGE_MAX_FILE_BYTES)
      : DEFAULT_MAX_FILE_BYTES,
    publicUrl: env.STORAGE_PUBLIC_URL?.replace(/\/+$/u, "") ?? null,
    region: env.STORAGE_REGION ?? "auto",
    secretAccessKey,
  };
};

let cachedClient: S3Client | null = null;

const getClient = (config: StorageConfig): S3Client => {
  cachedClient ??= new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    region: config.region,
  });
  return cachedClient;
};

interface StreamDigest {
  // SHA-1 identifies files the way mod launchers expect (Modrinth-compatible
  // hashes); it is not used for anything security-sensitive.
  sha1: Hash;
  sha512: Hash;
  size: number;
}

/**
 * Passes chunks through unchanged while hashing and enforcing the limit.
 * @yields {Uint8Array} Each chunk from `source`, unmodified.
 */
const hashAndLimit = async function* hashAndLimit(
  source: AsyncIterable<Uint8Array>,
  digest: StreamDigest,
  maxBytes: number
): AsyncGenerator<Uint8Array> {
  for await (const chunk of source) {
    digest.size += chunk.byteLength;
    if (digest.size > maxBytes) {
      throw new StorageError(
        STORAGE_ERROR.fileTooLarge,
        `File exceeds the ${maxBytes} byte limit.`
      );
    }
    digest.sha1.update(chunk);
    digest.sha512.update(chunk);
    yield chunk;
  }
};

const contentDisposition = (filename: string): string =>
  `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;

export const deleteObjects = async (
  keys: readonly string[],
  config: StorageConfig = loadStorageConfig(),
  client: S3Client = getClient(config)
): Promise<void> => {
  const batches: string[][] = [];
  for (let start = 0; start < keys.length; start += DELETE_BATCH_SIZE) {
    batches.push(keys.slice(start, start + DELETE_BATCH_SIZE));
  }
  await Promise.all(
    batches.map((batch) =>
      client.send(
        new DeleteObjectsCommand({
          Bucket: config.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        })
      )
    )
  );
};

/**
 * Streams an upload into storage while hashing it and enforcing the size
 * limit. Any failure removes whatever was written.
 */
export const uploadStream = async (
  input: UploadInput,
  config: StorageConfig = loadStorageConfig(),
  client: S3Client = getClient(config)
): Promise<UploadResult> => {
  const digest: StreamDigest = {
    // oxlint-disable-next-line sonarjs/hashing -- Content fingerprint, not a security control.
    sha1: createHash("sha1"),
    sha512: createHash("sha512"),
    size: 0,
  };

  const upload = new Upload({
    client,
    params: {
      Body: Readable.from(
        hashAndLimit(input.body, digest, config.maxFileBytes)
      ),
      Bucket: config.bucket,
      CacheControl: IMMUTABLE_CACHE_CONTROL,
      ContentDisposition: contentDisposition(input.filename),
      ContentType: input.contentType,
      Key: input.key,
    },
  });

  try {
    await upload.done();
  } catch (error) {
    await upload.abort().catch(() => null);
    await deleteObjects([input.key], config, client).catch(() => null);
    throw error;
  }

  return {
    sha1: digest.sha1.digest("hex"),
    sha512: digest.sha512.digest("hex"),
    size: digest.size,
  };
};

/** Public CDN URL when configured, otherwise a short-lived presigned URL. */
export const getDownloadUrl = (
  key: string,
  config: StorageConfig = loadStorageConfig(),
  client: S3Client = getClient(config)
): Promise<string> => {
  if (config.publicUrl) {
    const path = key.split("/").map(encodeURIComponent).join("/");
    return Promise.resolve(`${config.publicUrl}/${path}`);
  }
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    { expiresIn: PRESIGNED_DOWNLOAD_TTL_SECONDS }
  );
};
