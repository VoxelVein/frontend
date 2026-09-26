/**
 * Username rules shared by the server and the forms. Better Auth's username
 * plugin enforces the same length and character set; this module adds the
 * reserved names and the change cooldown on top.
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/u;
const INVALID_USERNAME_CHARACTERS = /[^a-z0-9_.]+/gu;
const EDGE_SEPARATORS = /^[_.]+|[_.]+$/gu;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** How long after a change the username is locked. */
export const USERNAME_CHANGE_COOLDOWN_MS = 14 * DAY_IN_MS;

/** How long a given-up username stays reserved for its previous owner. */
export const USERNAME_RESERVATION_MS = 14 * DAY_IN_MS;

/**
 * Names nobody can register: route segments, roles, and the brand, so a
 * username can never pose as a page or as staff.
 */
const RESERVED_USERNAMES = new Set([
  "about",
  "admin",
  "administrator",
  "api",
  "auth",
  "blog",
  "cookies",
  "dashboard",
  "disclaimer",
  "help",
  "legal",
  "login",
  "logout",
  "me",
  "mod",
  "moderator",
  "mods",
  "null",
  "official",
  "plugins",
  "privacy",
  "root",
  "settings",
  "signin",
  "signout",
  "signup",
  "staff",
  "support",
  "system",
  "terms",
  "undefined",
  "voxelvein",
  "welcome",
]);

export const normalizeUsername = (username: string): string =>
  username.trim().toLowerCase();

export const isReservedUsername = (username: string): boolean =>
  RESERVED_USERNAMES.has(normalizeUsername(username));

export type UsernameProblem = "too-short" | "too-long" | "invalid" | "reserved";

export const USERNAME_PROBLEM_MESSAGES = {
  invalid: "Use only letters, numbers, underscores, and periods.",
  reserved: "This username is reserved.",
  "too-long": `Username must be at most ${USERNAME_MAX_LENGTH} characters.`,
  "too-short": `Username must be at least ${USERNAME_MIN_LENGTH} characters.`,
} as const satisfies Record<UsernameProblem, string>;

/** Format and reserved-name check, without touching the database. */
export const getUsernameProblem = (
  username: string
): UsernameProblem | null => {
  const trimmed = username.trim();
  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return "too-short";
  }
  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return "too-long";
  }
  if (!USERNAME_PATTERN.test(trimmed)) {
    return "invalid";
  }
  if (isReservedUsername(trimmed)) {
    return "reserved";
  }
  return null;
};

/**
 * Turns a provider handle, email local part, or display name into a valid
 * username base. Always returns something usable, falling back to "user".
 */
export const toUsernameBase = (raw: string): string => {
  const cleaned = raw
    .toLowerCase()
    .replaceAll(INVALID_USERNAME_CHARACTERS, "_")
    .replaceAll(EDGE_SEPARATORS, "")
    .slice(0, USERNAME_MAX_LENGTH);

  if (cleaned.length < USERNAME_MIN_LENGTH || isReservedUsername(cleaned)) {
    return "user";
  }
  return cleaned;
};

/** Appends a numeric suffix while keeping within the maximum length. */
export const withUsernameSuffix = (base: string, suffix: string): string =>
  `${base.slice(0, USERNAME_MAX_LENGTH - suffix.length - 1)}_${suffix}`;

/** A timestamp as stored (Date) or as serialized to the browser (string). */
type Timestamp = Date | string;

/** When the user may change their username again, or null if they may now. */
export const getNextUsernameChange = (
  usernameChangedAt?: Timestamp | null,
  now: Date = new Date()
): Date | null => {
  if (!usernameChangedAt) {
    return null;
  }
  const next = new Date(
    new Date(usernameChangedAt).getTime() + USERNAME_CHANGE_COOLDOWN_MS
  );
  return next > now ? next : null;
};
