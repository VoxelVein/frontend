import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

// A full script-src CSP is not set: TanStack Start's SSR hydration relies on
// inline scripts, so a strict policy needs nonces first. These directives
// block framing (clickjacking), plugin content, and <base>/form hijacking.
const CONTENT_SECURITY_POLICY = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

const isProduction = process.env.NODE_ENV === "production";

const SECURITY_HEADERS = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Browsers ignore HSTS on plain-HTTP responses, so this is safe behind a
  // TLS-terminating proxy.
  ...(isProduction && {
    "Strict-Transport-Security": `max-age=${ONE_YEAR_IN_SECONDS}; includeSubDomains`,
  }),
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

// Some responses (e.g. Response.redirect) have immutable headers, so copy
// into a fresh Response before setting anything.
const withSecurityHeaders = (original: Response): Response => {
  const response = new Response(original.body, original);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
};

const securityHeadersMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next: runHandler }) => {
    const { response, ...result } = await runHandler();
    return { ...result, response: withSecurityHeaders(response) };
  }
);

// Server functions (project uploads, edits, deletes) authenticate with the
// session cookie, so reject cross-site calls to them.
const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, securityHeadersMiddleware],
}));
