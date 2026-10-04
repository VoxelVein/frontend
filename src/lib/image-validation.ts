import type { ProjectImageKind } from "@/lib/projects";

/**
 * Per-image ceiling. Generous, because originals are stored exactly as
 * uploaded and nothing is re-encoded: this exists to stop a single request
 * exhausting memory or the site quota, not to normalise file size.
 */
export { IMAGE_MAX_BYTES } from "@/lib/image-limits";

/** Gallery images allowed per project. */
export { GALLERY_MAX_COUNT } from "@/lib/image-limits";

/** Uploaded images are buffered whole to read their dimensions. */
const IMAGE_DIMENSION_LIMIT = 20_000;

export interface ImageDimensions {
  height: number;
  width: number;
}

export interface SniffedImage {
  contentType: AllowedImageType;
  dimensions: ImageDimensions;
  extension: string;
}

/** Content types an uploaded image may have, all sniffed from bytes. */
export const ALLOWED_IMAGE_TYPES = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/**
 * Magic-byte signatures per allowed format.
 *
 * SVG is deliberately absent. It is a scriptable document format, and these
 * images are served inline from the app's own origin, so an uploaded SVG
 * would execute in the site's context. GIF is included because pixel art
 * icons are frequently animated.
 */
const SIGNATURES: Record<AllowedImageType, { ext: string }> = {
  "image/gif": { ext: "gif" },
  "image/jpeg": { ext: "jpg" },
  "image/png": { ext: "png" },
  "image/webp": { ext: "webp" },
};

const PREFIXES: { bytes: readonly number[]; type: AllowedImageType }[] = [
  {
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    type: "image/png",
  },
  { bytes: [0xff, 0xd8, 0xff], type: "image/jpeg" },
  { bytes: [0x47, 0x49, 0x46, 0x38], type: "image/gif" },
];

// "RIFF" .... "WEBP": the size sits between, so the tag is checked at 8.
const RIFF = "RIFF";
const WEBP = "WEBP";

const ascii = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCodePoint(...bytes.subarray(offset, offset + length));

const startsWith = (bytes: Uint8Array, prefix: readonly number[]): boolean =>
  prefix.every((byte, index) => bytes[index] === byte);

const isRiffWebp = (bytes: Uint8Array): boolean =>
  ascii(bytes, 0, 4) === RIFF && ascii(bytes, 8, 4) === WEBP;

/** True when the leading bytes identify an allowed image format. */
export const isAllowedImageType = (bytes: Uint8Array): boolean =>
  PREFIXES.some((prefix) => startsWith(bytes, prefix.bytes)) ||
  isRiffWebp(bytes);

/**
 * Sniffs the real content type from the leading bytes.
 *
 * The request's own `content-type` header is client-controlled and is never
 * trusted here; the returned type always comes from the file itself.
 * Returns null for anything not in the allowlist.
 */
export const sniffImageType = (bytes: Uint8Array): AllowedImageType | null => {
  const match = PREFIXES.find((prefix) => startsWith(bytes, prefix.bytes));
  if (match) {
    return match.type;
  }
  return isRiffWebp(bytes) ? "image/webp" : null;
};

const readPngSize = (bytes: Uint8Array): ImageDimensions => {
  // Width and height are big-endian uint32 at offsets 16 and 20.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { height: view.getUint32(20), width: view.getUint32(16) };
};

const readGifSize = (bytes: Uint8Array): ImageDimensions => {
  // Little-endian uint16 at offsets 6 and 8.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { height: view.getUint16(8, true), width: view.getUint16(6, true) };
};

// Start-of-frame markers, which carry the frame dimensions. DHT (0xC4),
// JPG (0xC8) and DAC (0xCC) share the 0xC0-0xCF range but are not frames.
const START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

const findJpegSize = (bytes: Uint8Array): ImageDimensions | null => {
  // Walk the marker segments: each starts 0xFF, a type byte, a big-endian
  // uint16 length, then its payload. The frame header holds the dimensions.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 9 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (START_OF_FRAME_MARKERS.has(marker)) {
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      };
    }
    const length = view.getUint16(offset + 2);
    if (length < 2) {
      return null;
    }
    offset += 2 + length;
  }
  return null;
};

/** 24-bit little-endian read, used by the WebP extended header. */
const readUint24 = (bytes: Uint8Array, offset: number): number =>
  bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65_536;

const readWebpSize = (bytes: Uint8Array): ImageDimensions | null => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X") {
    // Stored as width-1 and height-1, so each is read and then increased.
    return {
      height: 1 + readUint24(bytes, 27),
      width: 1 + readUint24(bytes, 24),
    };
  }
  if (chunk === "VP8 ") {
    // 14 bits each, following a 2-bit scale factor.
    return {
      height: view.getUint16(26, true) % 16_384,
      width: view.getUint16(24, true) % 16_384,
    };
  }
  if (chunk === "VP8L") {
    const bits = view.getUint32(21, true);
    return {
      height: (bits % 16_384) + 1,
      width: (Math.floor(bits / 16_384) % 16_384) + 1,
    };
  }
  return null;
};

const isInRange = (value: number): boolean =>
  Number.isInteger(value) && value > 0 && value <= IMAGE_DIMENSION_LIMIT;

const isPlausibleSize = ({ height, width }: ImageDimensions): boolean =>
  isInRange(width) && isInRange(height);

type SizeReader = (bytes: Uint8Array) => ImageDimensions | null;

/** Dimension reader per content type. */
const SIZE_READERS: Record<AllowedImageType, SizeReader> = {
  "image/gif": readGifSize,
  "image/jpeg": findJpegSize,
  "image/png": readPngSize,
  "image/webp": readWebpSize,
};

/**
 * Reads the type, extension, and pixel dimensions from an image's leading
 * bytes. Returns null when the type is not allowed, when the dimensions
 * cannot be read, or when they are implausible. A zero or absurd size would
 * break the aspect ratio the UI reserves for the image.
 */
export const readImage = (bytes: Uint8Array): SniffedImage | null => {
  const contentType = sniffImageType(bytes);
  if (!contentType) {
    return null;
  }
  const extension = SIGNATURES[contentType].ext;

  const dimensions = SIZE_READERS[contentType](bytes);
  if (!dimensions || !isPlausibleSize(dimensions)) {
    return null;
  }
  return { contentType, dimensions, extension };
};

/** Storage filename for an image, derived from its own bytes. */
export const imageFilename = (
  id: string,
  extension: string,
  kind: ProjectImageKind
): string => `${kind}-${id}.${extension}`;
