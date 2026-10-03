import { STORAGE_ERROR, STORAGE_UNREACHABLE_MESSAGE } from "@/lib/storage";
import type { StorageError } from "@/lib/storage";

/**
 * How a storage failure is reported to a client.
 *
 * The `code` is as important as the message. A reader-facing string is the only
 * thing that survives an HTTP round trip by default, and a client that has to
 * string-match "could not reach" to recognise a broken file server will
 * silently stop recognising it the moment someone rewords the message — at which
 * point the reader gets a generic failure and no prompt to report anything.
 */

const HTTP_INSUFFICIENT_STORAGE = 507;
const HTTP_SERVICE_UNAVAILABLE = 503;

/** The body every route in this app answers an error with. */
interface ErrorBody {
  /** Machine-readable cause, present on storage failures. */
  code?: string;
  error: string;
}

const json = (status: number, message: string, code?: string): Response =>
  Response.json({ code, error: message } satisfies ErrorBody, { status });

/**
 * Turns a storage failure into a response.
 *
 * `noun` names the kind of thing being stored ("avatar", "image", "file") so
 * each route's fallback still reads as its own rather than as one shared
 * sentence.
 */
export const storageErrorResponse = (
  error: StorageError,
  noun: string
): Response => {
  if (error.code === STORAGE_ERROR.fileTooLarge) {
    return json(413, error.message, error.code);
  }
  if (error.code === STORAGE_ERROR.quotaExceeded) {
    return json(HTTP_INSUFFICIENT_STORAGE, error.message, error.code);
  }
  if (error.code === STORAGE_ERROR.unreachable) {
    // The only failure that is somebody else's fault and worth reporting, so it
    // is the only one answered with a message that says so. The code travels
    // alongside it so the client can choose its own wording.
    return json(
      HTTP_SERVICE_UNAVAILABLE,
      STORAGE_UNREACHABLE_MESSAGE,
      error.code
    );
  }
  if (error.code === STORAGE_ERROR.notConfigured) {
    return json(
      HTTP_SERVICE_UNAVAILABLE,
      `This site has no file server configured, so ${noun} cannot be stored.`,
      error.code
    );
  }
  return json(
    HTTP_SERVICE_UNAVAILABLE,
    `The ${noun} could not be stored right now.`,
    error.code
  );
};

export { json as errorResponse };
