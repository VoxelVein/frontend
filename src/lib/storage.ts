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
// Images are served through a proxy route that sets its own caching, and
// their keys are not content-addressed: replacing an icon reuses its row.
const REVALIDATE_CACHE_CONTROL = "public, max-age=0, must-revalidate";
const DELETE_BATCH_SIZE = 1000;

export interface StorageConfig {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  forcePathStyle: boolean;
  maxFileBytes: number;
  publicUrl: string | null;
  /** Total bytes all stored files may use; null means unlimited. */
  quotaBytes: number | null;
  region: string;
  secretAccessKey: string;
}

export interface UploadInput {
  body: AsyncIterable<Uint8Array>;
  contentType: string;
  /**
   * When true the object is served for display in a browser — inline
   * disposition, revalidating cache — rather than as a download. Required
   * for images, which a browser would otherwise save instead of rendering.
   */
  inline?: boolean;
  filename: string;
  key: string;
  /** Lower byte limit for this upload, e.g. the space left in the quota. */
  maxBytes?: number;
}

export interface UploadResult {
  sha1: string;
  sha512: string;
  size: number;
}

export const STORAGE_ERROR = {
  fileTooLarge: "file-too-large",
  notConfigured: "not-configured",
  quotaExceeded: "quota-exceeded",
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
    quotaBytes: env.STORAGE_QUOTA_BYTES
      ? Number(env.STORAGE_QUOTA_BYTES)
      : null,
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
        hashAndLimit(
          input.body,
          digest,
          Math.min(config.maxFileBytes, input.maxBytes ?? Infinity)
        )
      ),
      Bucket: config.bucket,
      CacheControl: input.inline
        ? REVALIDATE_CACHE_CONTROL
        : IMMUTABLE_CACHE_CONTROL,
      ContentDisposition: input.inline
        ? `inline; filename*=UTF-8''${encodeURIComponent(input.filename)}`
        : contentDisposition(input.filename),
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

/**
 * Fetches an object's bytes and metadata, for serving an image through the
 * app rather than redirecting to a URL. Unlike a download this cannot use a
 * presigned URL, because the response has to pass through the app to enforce
 * the project-visibility rules.
 */
export const getObjectBytes = async (
  key: string,
  config: StorageConfig = loadStorageConfig(),
  client: S3Client = getClient(config)
): Promise<{
  body: ReadableStream;
  contentLength: number | null;
  etag: string | null;
}> => {
  const response = await client.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key })
  );
  if (!response.Body) {
    throw new StorageError(
      STORAGE_ERROR.notConfigured,
      "The stored object has no body."
    );
  }
  return {
    // SAFETY: the check above guarantees Body is present, and the AWS SDK
    // types it as a Node Readable, which is a ReadableStream at runtime in
    // the web-fetch handler this runs under.
    body: response.Body as ReadableStream,
    contentLength: response.ContentLength ?? null,
    // Weak ETags from multipart uploads are still valid cache validators.
    etag: response.ETag ?? null,
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
