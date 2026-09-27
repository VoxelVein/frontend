import type { ProjectType } from "@/lib/projects";

export const JAR_CONTENT_TYPE = "application/java-archive";
export const ZIP_CONTENT_TYPE = "application/zip";
export const MRPACK_CONTENT_TYPE = "application/x-modrinth-modpack+zip";
export const FILENAME_MAX_LENGTH = 128;

/**
 * File kinds each type may upload. Every one of them is a zip archive, which
 * the upload route checks by magic bytes. Servers upload nothing.
 */
export const ALLOWED_EXTENSIONS_BY_TYPE = {
  mod: [".jar"],
  modpack: [".mrpack", ".zip"],
  plugin: [".jar"],
  resourcepack: [".zip"],
  server: [],
  shader: [".zip"],
} as const satisfies Record<ProjectType, readonly string[]>;

const CONTENT_TYPE_BY_EXTENSION = {
  ".jar": JAR_CONTENT_TYPE,
  ".mrpack": MRPACK_CONTENT_TYPE,
  ".zip": ZIP_CONTENT_TYPE,
} as const;

/** Content type to store and serve a file under, from its extension. */
export const contentTypeFor = (filename: string): string => {
  const lower = filename.toLowerCase();
  for (const [extension, contentType] of Object.entries(
    CONTENT_TYPE_BY_EXTENSION
  )) {
    if (lower.endsWith(extension)) {
      return contentType;
    }
  }
  return "application/octet-stream";
};

// A zip local file header (every .jar is a zip): "PK\x03\x04".
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/u;

/**
 * Returns the filename when it is safe to store and serve and has an
 * extension the project type accepts, else null.
 */
export const sanitizeFilename = (
  value: string | null,
  type: ProjectType
): string | null => {
  if (!value || value.length > FILENAME_MAX_LENGTH) {
    return null;
  }
  if (!SAFE_FILENAME.test(value) || value.includes("..")) {
    return null;
  }
  const lower = value.toLowerCase();
  return ALLOWED_EXTENSIONS_BY_TYPE[type].some((extension) =>
    lower.endsWith(extension)
  )
    ? value
    : null;
};

export const hasZipMagic = (bytes: Uint8Array): boolean =>
  bytes.length >= ZIP_MAGIC.length &&
  ZIP_MAGIC.every((byte, index) => bytes[index] === byte);

export interface PeekedStream {
  head: Uint8Array;
  stream: AsyncIterable<Uint8Array>;
}

/**
 * Reads at least `length` bytes from the start of a stream without losing
 * them: the returned iterable replays what was read, then the rest.
 */
export const peekStream = async (
  body: ReadableStream<Uint8Array>,
  length: number
): Promise<PeekedStream> => {
  const reader = body.getReader();
  const buffered: Uint8Array[] = [];
  let bufferedLength = 0;

  while (bufferedLength < length) {
    // oxlint-disable-next-line no-await-in-loop -- Stream chunks must be read in order.
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffered.push(value);
    bufferedLength += value.byteLength;
  }

  const head = new Uint8Array(bufferedLength);
  let offset = 0;
  for (const chunk of buffered) {
    head.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const replay = async function* replay(): AsyncGenerator<Uint8Array> {
    if (head.byteLength > 0) {
      yield head;
    }
    try {
      while (true) {
        // oxlint-disable-next-line no-await-in-loop -- Stream chunks must be read in order.
        const { done, value } = await reader.read();
        if (done) {
          return;
        }
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  };

  return { head, stream: replay() };
};
