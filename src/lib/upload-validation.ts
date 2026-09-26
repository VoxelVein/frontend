// Only Java archives for now: mods and plugins both ship as .jar files.
export const ALLOWED_EXTENSIONS = [".jar"] as const;
export const JAR_CONTENT_TYPE = "application/java-archive";
export const FILENAME_MAX_LENGTH = 128;

// A zip local file header (every .jar is a zip): "PK\x03\x04".
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/u;

/** Returns the filename when it is safe to store and serve, else null. */
export const sanitizeFilename = (value: string | null): string | null => {
  if (!value || value.length > FILENAME_MAX_LENGTH) {
    return null;
  }
  if (!SAFE_FILENAME.test(value) || value.includes("..")) {
    return null;
  }
  const lower = value.toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension))
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
