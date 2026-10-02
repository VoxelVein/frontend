import { getForwardedClientIp } from "@/lib/client-key";
import { consumeRateLimit } from "@/lib/rate-limit";
import type { RateLimit, RateLimitResult } from "@/lib/rate-limit";

/**
 * The identity a rate limit is counted against.
 *
 * Prefers the signed-in user and falls back to the client address, so a shared
 * NAT does not throttle everyone behind it while an anonymous visitor still has
 * a bucket. `getClientKey` in the download route builds the same two shapes.
 */
export const rateLimitIdentity = (
  headers: Headers,
  trustProxy: boolean,
  userId?: string | null
): string => {
  if (userId) {
    return `user:${userId}`;
  }
  return `ip:${getForwardedClientIp(headers, trustProxy) ?? "unknown"}`;
};

/**
 * Consumes a bucket and reports whether to refuse.
 *
 * The shape a server function needs: `createServerFn` has no way to set a
 * `Retry-After` header, so it refuses by throwing and the caller turns that
 * into whatever the surface it renders into — a toast, a form error, a render.
 * API routes use `rateLimitedResponse` instead, which can set the header.
 */
export const consumeServerLimit = async (
  bucket: string,
  identity: string,
  limit: RateLimit
): Promise<RateLimitResult | null> => {
  const result = await consumeRateLimit(bucket, identity, limit);
  return result.limited ? result : null;
};

/** The message a refused server function throws. */
export const RATE_LIMIT_MESSAGE = "Too many requests. Try again shortly.";
