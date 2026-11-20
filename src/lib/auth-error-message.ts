/** Replaces Better Auth's terse rate-limit response with actionable wording. */
export const authErrorMessage = (
  message: string | undefined,
  fallback: string
): string => {
  if (message && /too many requests|rate.?limit|\b429\b/iu.test(message)) {
    return "Too many attempts. Please wait a minute, then try again.";
  }

  return message || fallback;
};
