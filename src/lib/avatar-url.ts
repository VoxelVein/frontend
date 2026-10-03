/**
 * Rules for a user-supplied external profile-picture URL.
 *
 * `users.image` is read by every avatar surface — the navbar, the account menu,
 * the public profile, and every blog byline — so whatever lands there is
 * rendered in an `<img src>` on pages other people visit. This module is the one
 * place that decides what may be stored.
 */

/**
 * Long enough for a signed CDN URL with query parameters, short enough that the
 * column is never a place to park arbitrary text.
 */
const AVATAR_URL_MAX_LENGTH = 2048;

const AVATAR_URL_HINT = "Enter an https:// image URL.";

/**
 * Whether a stored avatar value may be rendered.
 *
 * Two shapes are accepted, and only two:
 *
 * * an absolute `https:` URL, which is what a user-supplied external picture is;
 * * a root-relative path, which is what an upload produces (`/api/avatar/$id`).
 *
 * Everything else falls back to the letter tile. An `<img src>` will not execute
 * `javascript:` or `data:`, so this is not the control that stops script — the
 * allowlist below is. It is here so that a value which somehow reached the
 * column by another route (a provider profile, an older row) still renders as a
 * picture or as initials, and never as a third scheme nobody intended to allow.
 */
const isSafeAvatarSrc = (value: string | null | undefined): boolean => {
  if (!value) {
    return false;
  }

  // A root-relative path, but not protocol-relative `//host/x`, which is a
  // scheme-relative URL to another origin and would look like a local path.
  if (value.startsWith("/") && !value.startsWith("//")) {
    return true;
  }

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Whether the value points at somebody else's server rather than at our own
 * uploads. Drives the "hosted elsewhere" note in settings.
 */
const isExternalAvatarSrc = (value: string | null | undefined): boolean =>
  Boolean(value) && !value?.startsWith("/");

/**
 * Normalizes a typed-in URL, or reports why it cannot be used.
 *
 * Returns `null` for an empty field, which the caller reads as "clear the
 * picture" rather than as an error: emptying a field is how a user asks for no
 * picture, and treating that as invalid would make it impossible to unset one
 * without the upload controls.
 *
 * `https` only, deliberately:
 *
 * * `http:` would be blocked as mixed content on an HTTPS site anyway, so
 *   accepting it would store a value that never renders — and would send the
 *   visitor's IP address to a third party in plaintext if the site were ever
 *   served over HTTP.
 * * `javascript:` and `data:` cannot execute from an `<img src>`, but a `data:`
 *   blob would let arbitrary bytes be pinned into every avatar surface on the
 *   site, and neither is a "picture location" in any useful sense.
 * * Credentials in the authority (`https://user:pass@host/`) are rejected: they
 *   leak into logs, referrers, and anything that renders the URL as text.
 */
const parseAvatarUrl = (
  value: string
): { ok: true; url: string | null } | { ok: false; error: string } => {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return { ok: true, url: null };
  }

  if (trimmed.length > AVATAR_URL_MAX_LENGTH) {
    return { ok: false, error: "That URL is too long." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: AVATAR_URL_HINT };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: AVATAR_URL_HINT };
  }

  if (parsed.username !== "" || parsed.password !== "") {
    return {
      ok: false,
      error: "Remove the username and password from that URL.",
    };
  }

  // A bare origin is not a picture, and almost always means a truncated paste.
  if (parsed.pathname === "" || parsed.pathname === "/") {
    return { ok: false, error: "That URL does not point to an image." };
  }

  return { ok: true, url: parsed.toString() };
};

export {
  AVATAR_URL_MAX_LENGTH,
  isExternalAvatarSrc,
  isSafeAvatarSrc,
  parseAvatarUrl,
};
