/**
 * What a file server that is missing, or that did not answer, is called and how
 * it is reported to a reader.
 *
 * One module because the same three sentences appear in a tooltip, in helper
 * text beside a disabled control, and in a toast, and they must not drift into
 * saying different things about whose fault a failure is.
 */

/**
 * A storage failure the server classified.
 *
 * Carries the code alongside the message so callers react to *why* rather than
 * to wording. A reader-facing string is all that survives an HTTP round trip by
 * default, and a client that string-matches "could not reach" stops recognising
 * a broken file server the moment somebody rewords it — at which point the
 * reader gets a generic failure and no prompt to report anything.
 */
export class StorageRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "StorageRequestError";
    this.code = code;
  }
}

/**
 * What the tooltip says when storage is missing.
 *
 * It names no variables and no endpoint. The reader can act on neither, and a
 * tooltip that reads like a log line is one people learn to skip. "The admins
 * have not configured the file server" is the part that is both true and worth
 * reporting — it tells the reader this is not their fault and not their
 * connection either.
 */
export const STORAGE_UNAVAILABLE_REASON =
  "Uploads are unavailable: the admins have not configured the file server for this site. Nothing is wrong with your device or your connection.";

/**
 * The same reason as helper text, for beside the control.
 *
 * Plainer, and it names the fix, because this one is read by people who want to
 * do something about it — including whoever ends up telling the admins.
 */
export const storageUnavailableNote = (noun = "Uploads"): string =>
  `${noun} need the file server, which this site does not have configured.`;

/**
 * The toast for an endpoint that did not answer.
 *
 * The one failure that is nobody's fault at the keyboard and is worth somebody
 * else's time, so it says three things: what happened, that it is not the
 * reader's doing, and that reporting it helps. A generic "upload failed" leaves
 * all three unsaid.
 */
export const STORAGE_UNREACHABLE_TOAST =
  "Could not reach the file server, so nothing was saved. This is a server problem rather than yours — please report it.";

/**
 * Picks the message for a failed storage action.
 *
 * Falls back to whatever the server said, and then to the caller's own wording.
 * A failure the server classified as something we have no special wording for is
 * still better described by the server than by us inventing a second sentence.
 */
export const storageFailureMessage = (
  cause: unknown,
  fallback: string
): string => {
  if (cause instanceof StorageRequestError) {
    if (cause.code === "unreachable") {
      return STORAGE_UNREACHABLE_TOAST;
    }
    if (cause.code === "not-configured") {
      return STORAGE_UNAVAILABLE_REASON;
    }
  }
  if (cause instanceof Error && cause.message) {
    return cause.message;
  }
  return fallback;
};
