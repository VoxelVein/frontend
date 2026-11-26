/**
 * A deliberately small profanity check for short user-written text.
 *
 * It catches the obvious abuse without pretending to be a general content
 * classifier: matching is on whole, de-obfuscated tokens, so "class" is not
 * "ass" and "f*ck" still is "fuck". Anything it misses is a moderation issue
 * for staff, not a reason to block ordinary words by substring.
 */

/** The message used both by Valibot and by the submit handlers. */
export const CONTENT_FILTER_MESSAGE = "Please avoid offensive language.";

const BLOCKED_WORDS = [
  "ass",
  "bastard",
  "bitch",
  "bullshit",
  "cunt",
  "dick",
  "douche",
  "fag",
  "faggot",
  "fuck",
  "fucking",
  "nigga",
  "nigger",
  "piss",
  "retard",
  "shit",
  "slut",
  "twat",
  "whore",
] as const;

const BLOCKED = new Set<string>(BLOCKED_WORDS);

/** Digits and @ standing in for letters, the common way a token is disguised. */
const LEET = new Map([
  ["0", "o"],
  ["1", "i"],
  ["3", "e"],
  ["4", "a"],
  ["5", "s"],
  ["7", "t"],
  ["@", "a"],
  ["*", "u"],
]);

/** Strips punctuation inside a token and folds the usual leetspeak digits. */
const cleanToken = (token: string): string =>
  token
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}@*]/gu, "")
    .replaceAll(
      /[013457@*]/gu,
      (character) => LEET.get(character) ?? character
    );

/** Whether any whole word in the text is on the blocked list. */
export const containsBlockedWord = (value: string): boolean =>
  value.split(/\s+/u).some((token) => BLOCKED.has(cleanToken(token)));
