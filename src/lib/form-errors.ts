import { flatten } from "valibot";
import type { BaseIssue } from "valibot";

/** Field name to its first validation message. */
export type FieldErrors = ReadonlyMap<string, string>;

export const NO_FIELD_ERRORS: FieldErrors = new Map();

/** First message per top-level field, keyed by the field name. */
export const toFieldErrors = (
  issues: [BaseIssue<unknown>, ...BaseIssue<unknown>[]]
): Map<string, string> => {
  const { nested = {} } = flatten(issues);
  const errors = new Map<string, string>();
  for (const [path, messages] of Object.entries(nested)) {
    const [field] = path.split(".");
    const [message] = messages ?? [];
    if (field && message && !errors.has(field)) {
      errors.set(field, message);
    }
  }
  return errors;
};

export const errorMessage = (cause: unknown, fallback: string): string =>
  cause instanceof Error && cause.message ? cause.message : fallback;
