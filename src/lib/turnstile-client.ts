import { TURNSTILE_TOKEN_HEADER } from "@/lib/turnstile";

export const getTurnstileSiteKey = (): string =>
  // SAFETY: Vite exposes VITE_* vars as `any`; the value is a string when set
  // and undefined when absent.
  (
    (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? ""
  ).trim();

export const isTurnstileEnabled = (): boolean =>
  getTurnstileSiteKey().length > 0;

/** Fetch options that attach a Turnstile token to a Better Auth request. */
export const turnstileFetchOptions = (token: string | null) =>
  token ? { headers: { [TURNSTILE_TOKEN_HEADER]: token } } : undefined;
