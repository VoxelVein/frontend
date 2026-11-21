import { AVATAR_MAX_BYTES } from "@/lib/image-limits";
import type { Dimensions } from "@/lib/image-resize";

/**
 * The image formats an avatar may be uploaded in.
 *
 * Mirrors the server-side allowlist in `image-validation.ts`: GIF is included
 * because pixel art avatars are frequently animated, and SVG is deliberately
 * absent because it is a scriptable document format.
 */
export const AVATAR_ACCEPTED_TYPES = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AvatarAcceptedType = (typeof AVATAR_ACCEPTED_TYPES)[number];

/** Whether a file type is one the avatar pipeline accepts. */
export const isAcceptedAvatarType = (
  type: string | null | undefined
): type is AvatarAcceptedType =>
  (AVATAR_ACCEPTED_TYPES as readonly string[]).includes(type ?? "");

/** Whether a file is small enough to be cropped and stored as an avatar. */
export const isAvatarWithinLimit = (bytes: number): boolean =>
  bytes > 0 && bytes <= AVATAR_MAX_BYTES;

/**
 * Reads the pixel size of a file, applying the EXIF orientation.
 *
 * Returns null when the browser cannot decode the file, so the caller can
 * refuse the upload before it reaches the cropper rather than failing there.
 */
export const readAvatarDimensions = async (
  file: File
): Promise<Dimensions | null> => {
  if (!isAcceptedAvatarType(file.type)) {
    return null;
  }

  if ("createImageBitmap" in globalThis) {
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
