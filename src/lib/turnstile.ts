import { boolean, object, optional, safeParse, string } from "valibot";
import type { InferOutput } from "valibot";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SITEVERIFY_TIMEOUT_MS = 10_000;
const MAX_TOKEN_LENGTH = 2048;

// Cloudflare's documented dummy secrets
// (https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
// Tokens verified with them report `hostname: "example.com"` and no action,
// so they can only be used for local development and tests.
const TESTING_SECRET_PREFIXES = ["1x", "2x", "3x"] as const;

// Request header the frontend sends the widget token in. Better Auth validates
// request bodies strictly, so the token travels as a header instead of the
// `cf-turnstile-response` form field.
export const TURNSTILE_TOKEN_HEADER = "cf-turnstile-response";

export type TurnstileAction = "login" | "signup";

export interface TurnstileConfig {
  hostnames: ReadonlySet<string>;
  isProduction: boolean;
  secret: string | null;
}

export interface TurnstileVerifyInput {
  expectedAction: TurnstileAction;
  remoteIp?: string | null;
  token: string | null | undefined;
}

export const TURNSTILE_FAILURE = {
  missingToken: "missing-token",
  notConfigured: "not-configured",
  rejected: "rejected",
  siteverifyUnavailable: "siteverify-unavailable",
} as const;

export type TurnstileFailureReason =
  (typeof TURNSTILE_FAILURE)[keyof typeof TURNSTILE_FAILURE];

export type TurnstileVerifyResult =
  | { ok: true }
  | { ok: false; reason: TurnstileFailureReason };

const siteverifyResponseSchema = object({
  action: optional(string()),
  hostname: optional(string()),
  metadata: optional(object({ result_with_testing_key: optional(boolean()) })),
  success: boolean(),
});

type SiteverifyResponse = InferOutput<typeof siteverifyResponseSchema>;

export const parseHostnames = (value: string | undefined): Set<string> =>
  new Set(
    (value ?? "")
      .split(",")
      .map((hostname) => hostname.trim())
      .filter(Boolean)
  );

export const isTestingSecret = (secret: string): boolean =>
  TESTING_SECRET_PREFIXES.some((prefix) => secret.startsWith(`${prefix}0000`));

/**
 * Checks that Turnstile is configured safely for the current environment.
 * Returns a list of problems; an empty list means the config is usable.
 */
export const getTurnstileConfigProblems = (
  config: TurnstileConfig
): string[] => {
  const problems: string[] = [];

  if (!config.secret) {
    problems.push("TURNSTILE_SECRET is not set.");
  }
  if (config.hostnames.size === 0) {
    problems.push("TURNSTILE_HOSTNAMES is not set.");
  }
  if (!config.isProduction) {
    return problems;
  }
  if (config.secret && isTestingSecret(config.secret)) {
    problems.push("TURNSTILE_SECRET is a Cloudflare testing secret.");
  }
  for (const local of ["localhost", "127.0.0.1"]) {
    if (config.hostnames.has(local)) {
      problems.push(`TURNSTILE_HOSTNAMES must not include ${local}.`);
    }
  }

  return problems;
};

const isAcceptedResult = (
  result: SiteverifyResponse,
  expectedAction: TurnstileAction,
  config: TurnstileConfig
): boolean => {
  if (!result.success) {
    return false;
  }

  // Testing keys never return the real action or hostname. Accept them only
  // outside production; production refuses testing secrets entirely.
  const isTestingResult = result.metadata?.result_with_testing_key === true;
  if (isTestingResult) {
    return !config.isProduction;
  }

  return (
    result.action === expectedAction &&
    config.hostnames.has(result.hostname ?? "")
  );
};

/**
 * Canonical server-side Turnstile check: the token must pass siteverify, carry
 * the expected action, and come from an approved hostname. Fails closed on any
 * error.
 */
export const verifyTurnstileToken = async (
  input: TurnstileVerifyInput,
  config: TurnstileConfig,
  fetchImpl: typeof fetch = fetch
): Promise<TurnstileVerifyResult> => {
  const { expectedAction, remoteIp, token } = input;

  if (getTurnstileConfigProblems(config).length > 0 || !config.secret) {
    return { ok: false, reason: TURNSTILE_FAILURE.notConfigured };
  }

  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, reason: TURNSTILE_FAILURE.missingToken };
  }

  const body = new URLSearchParams({ response: token, secret: config.secret });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  let result: SiteverifyResponse;
  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ok: false, reason: TURNSTILE_FAILURE.siteverifyUnavailable };
    }
    const parsed = safeParse(siteverifyResponseSchema, await response.json());
    if (!parsed.success) {
      return { ok: false, reason: TURNSTILE_FAILURE.siteverifyUnavailable };
    }
    result = parsed.output;
  } catch {
    return { ok: false, reason: TURNSTILE_FAILURE.siteverifyUnavailable };
  }

  return isAcceptedResult(result, expectedAction, config)
    ? { ok: true }
    : { ok: false, reason: TURNSTILE_FAILURE.rejected };
};
