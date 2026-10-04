import type { ProjectImageKind } from "@/lib/projects";

/**
 * Longest edge, in pixels, that each kind of image is stored at.
 *
 * An icon is displayed at 44-80px, so 512 leaves room for a high-density
 * screen without storing a phone camera's worth of pixels. A gallery image is
 * shown in a full-width grid, so 1920 is about right for a 2x display.
 *
 * These are upper bounds: an image already smaller than the target is stored
 * untouched rather than re-encoded, so resizing never costs quality or bytes.
 */
export const MAX_EDGE_BY_KIND = {
  gallery: 1920,
  icon: 512,
} as const satisfies Record<ProjectImageKind, number>;

/** WebP at this quality is visually close to the source and far smaller. */
const WEBP_QUALITY = 0.9;

export interface Dimensions {
  height: number;
  width: number;
}

/** Output format for a source image, given what it is and what we can encode. */
export const outputTypeFor = (sourceType: string): string =>
  // PNG keeps its alpha exactly, which matters for an icon with a
  // transparent background. WebP also carries alpha, but re-encoding a PNG to
  // WebP gains little at these sizes and loses the simplest possible asset.
  sourceType === "image/png" ? "image/png" : "image/webp";

/**
 * Scales an image down to fit its kind's longest edge, preserving aspect
 * ratio. Never upscales.
 *
 * Pure so the geometry can be tested without a canvas.
 */
export const scaledSize = (
  kind: ProjectImageKind,
  { height, width }: Dimensions
): Dimensions => {
  const maxEdge = MAX_EDGE_BY_KIND[kind];
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { height, width };
  }
  const scale = maxEdge / longest;
  return {
    // Rounded, and floored at 1 so a very thin strip never collapses to zero.
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
};

/**
 * Whether an image needs re-encoding at all.
 *
 * A GIF is left alone: it is almost always pixel art or a short animation,
 * and canvas cannot preserve the frames, so resizing would silently turn an
 * animation into a still image.
 */
export const needsResize = (
  kind: ProjectImageKind,
  { height, type, width }: Dimensions & { type: string }
): boolean =>
  type !== "image/gif" && Math.max(width, height) > MAX_EDGE_BY_KIND[kind];

/** Reads the pixel size of a file, applying the EXIF orientation. */
const readDimensions = async (file: Blob): Promise<Dimensions> => {
  if ("createImageBitmap" in globalThis) {
    // `from-image` applies the EXIF rotation, so a photo taken in portrait is
    // not resized as though it were landscape.
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const size = { height: bitmap.height, width: bitmap.width };
    bitmap.close();
    return size;
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { height: image.naturalHeight, width: image.naturalWidth };
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** Promise wrapper around the callback-only `canvas.toBlob`. */
const encode = (
  canvas: HTMLCanvasElement,
  type: string
): Promise<Blob | null> =>
  // oxlint-disable-next-line promise/avoid-new -- canvas.toBlob is a callback API with no promise form
  new Promise((resolve) => {
    canvas.toBlob(resolve, type, WEBP_QUALITY);
  });

/** Decodes a blob into an <img>, resolving null if it cannot be decoded. */
const decodeImage = async (file: Blob): Promise<HTMLImageElement | null> => {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const drawToBlob = async (
  file: Blob,
  size: Dimensions,
  type: string
): Promise<Blob | null> => {
  const image = await decodeImage(file);
  if (!image) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  // JPEG has no alpha, so without this a transparent source would come out on
  // a black background.
  if (type === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
  }
  context.drawImage(image, 0, 0, size.width, size.height);
  return encode(canvas, type);
};

/**
 * Downscales an image before upload.
 *
 * Resizing in the browser is what actually saves the storage: the original
 * never reaches the bucket, so there is nothing to delete later and no
 * server CPU spent re-encoding it. Returns the file unchanged when it is
 * already small enough, is an animated GIF, or the browser cannot encode the
 * result, so this can never be the reason an upload fails.
 */
export const resizeImageForUpload = async (
  file: File,
  kind: ProjectImageKind
): Promise<File> => {
  try {
    const source = await readDimensions(file);
    if (!needsResize(kind, { ...source, type: file.type })) {
      return file;
    }

    const type = outputTypeFor(file.type);
    const blob = await drawToBlob(file, scaledSize(kind, source), type);
    if (!blob) {
      return file;
    }

    // Same extension the server will sniff, so the filename stays meaningful.
    const extension = type === "image/png" ? "png" : "webp";
    const name = file.name.replace(/\.[^.]+$/u, "") || "image";
    return new File([blob], `${name}.${extension}`, { type });
  } catch {
    // A browser that cannot decode the file should still be able to upload
    // it; the server validates the real type either way.
    return file;
  }
};
