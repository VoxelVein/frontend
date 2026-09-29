/**
 * Upload limits shared by the client and the server.
 *
 * Deliberately a module of its own: the byte-parsing helpers in
 * `image-validation.ts` are server-only, and importing them from a client
 * component to read these two numbers would pull the whole parser into the
 * browser bundle.
 */

/**
 * Per-image ceiling. Generous, because originals are stored exactly as
 * uploaded and nothing is re-encoded: this exists to stop a single request
 * exhausting memory or the site quota, not to normalise file size.
 */
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/** Gallery images allowed per project. */
export const GALLERY_MAX_COUNT = 12;
