import { check, maxLength, nullish, pipe, string } from "valibot";

/**
 * Longest bio a user can save, in characters.
 *
 * A bio is a paragraph or two, so this sits well below the project
 * description (50,000) and above the project summary (160). The cap is
 * enforced here rather than by a database constraint because it is a
 * validation rule, and because the profile renders this as Markdown on a
 * public page: an unbounded field is an unbounded amount of rendering work
 * for every visitor.
 */
export const BIO_MAX_LENGTH = 500;

const TOO_LONG = `Bio must be ${BIO_MAX_LENGTH} characters or fewer.`;

/**
 * The bio as typed into settings.
 *
 * Empty is valid and means "no bio", so there is no required check: clearing
 * the field is how a user removes a bio. Whitespace-only is left to
 * `normalizeBio` rather than rejected here, because rejecting it would turn
 * "clear this field" into an error the user cannot act on.
 */
export const bioSchema = pipe(string(), maxLength(BIO_MAX_LENGTH, TOO_LONG));

/**
 * The same cap at the server boundary, where the value may be absent or null.
 *
 * Better Auth validates `updateUser` input against this, which is what stops a
 * direct API call from storing a bio far past what the form allows. The form
 * only ever produces a string, but clearing a bio sends null, so null has to
 * pass here.
 */
export const bioInputSchema = pipe(
  nullish(string()),
  check(
    (value) =>
      value === null || value === undefined || value.length <= BIO_MAX_LENGTH,
    TOO_LONG
  )
);

/**
 * The bio to store: trimmed, and null when nothing is left.
 *
 * Surrounding whitespace is dropped so the Markdown does not start as an
 * indented code block, and a bio that is only whitespace becomes null rather
 * than an empty block on the profile.
 */
export const normalizeBio = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};
