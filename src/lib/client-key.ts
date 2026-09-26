/**
 * Reads `TRUST_PROXY`. In production the value must be set explicitly, so a
 * deployment cannot silently run without per-client limits: `true` when a
 * reverse proxy sets `X-Forwarded-For`, `false` to accept running without
 * them.
 */
export const readTrustProxy = (
  value: string | undefined,
  production: boolean
): boolean => {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (production) {
    throw new Error(
      'TRUST_PROXY must be set to "true" (behind a reverse proxy that sets X-Forwarded-For) or "false" (no per-client limits) in production.'
    );
  }
  return false;
};

/**
 * Client IP from `X-Forwarded-For`, or null when the header is not trusted.
 *
 * Uses the last entry: proxies append the address they received the request
 * from, so the rightmost value is the one our proxy added. Earlier entries
 * come from the client and can be forged.
 */
export const getForwardedClientIp = (
  headers: Headers,
  trustProxy: boolean
): string | null => {
  if (!trustProxy) {
    return null;
  }
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",").at(-1)?.trim() || null;
};
