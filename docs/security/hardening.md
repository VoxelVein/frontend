# Hardening

The defensive configuration: response headers, CSRF scope, open-redirect
protection, and the gates on uploads and filenames.

## Response headers

`src/start.ts` applies one header set to every server response through a
request middleware.

`Content-Security-Policy`
: Framing, plugin content, and `<base>`/form hijacking. See below.

`Cross-Origin-Opener-Policy`
: `same-origin`, isolating the browsing context.

`Permissions-Policy`
: `camera=(), geolocation=(), microphone=()` — denies three APIs the app
  never uses.

`Referrer-Policy`
: `strict-origin-when-cross-origin`, so no path leaks cross-origin.

`X-Content-Type-Options`
: `nosniff`, no MIME sniffing.

`X-Frame-Options`
: `DENY`, legacy framing defence kept alongside the CSP.

`Strict-Transport-Security`
: `max-age=31536000; includeSubDomains`, emitted **in production only**.

The CSP sets four directives and deliberately **no `script-src`**:

```text
frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'
```

A strict script policy is not possible yet, because TanStack Start's SSR
hydration relies on inline scripts. Adding one properly means issuing
per-request nonces, not just appending a directive. The four above still
block clickjacking, plugin content, and `<base>`/form hijacking.

HSTS is emitted only when `NODE_ENV=production`, since browsers ignore it
on plain HTTP. That makes it safe behind a TLS-terminating proxy like the
one Dokploy fronts the stack with.

Headers are applied to a **fresh `Response`** rather than mutated in place,
because some responses — `Response.redirect` among them — have immutable
headers and `headers.set` would throw.

## CSRF scope

`createCsrfMiddleware` is filtered to
`context.handlerType === "serverFn"`. Server functions authenticate with
the session cookie, so they are the cross-site risk; the JSON API routes
are outside this check by design.

## Trusted origins

`BETTER_AUTH_URL` is the primary origin. `trustedOrigins` additionally
includes `http://localhost:3000` and every comma-separated entry in
`BETTER_AUTH_TRUSTED_ORIGINS` (`src/lib/auth.ts:192`).

Set that variable when the app is reached at more than one origin — a
preview deployment, or a staging host sharing a database. It is accepted
by `env.config.ts` and documented nowhere else, which is the only reason
it is mentioned here.

## Account linking

`accountLinking` sets `allowDifferentEmails: true` but
`requireLocalEmailVerified: true` (`src/lib/auth.ts:202`).

Both halves matter. Allowing a differing email is what lets a user link a
Google or GitHub account that does not match theirs. Requiring the
*local* email to be verified is what stops pre-registration takeover: an
attacker registers with a victim's address and a password, and the victim
is silently linked into that account the first time they sign in
socially.

Note the interaction with `requireEmailVerification: false`
(`src/lib/auth.ts:253`). Since no email is ever verified, no social login
auto-links at all today, which is stricter than the source comment
implies. Linking still works explicitly, from an active session. If email
verification is ever switched on, the takeover path reopens only if this
flag is dropped at the same time.

## Open redirects

`src/lib/safe-redirect.ts` sanitises the `redirect` search parameter on
`/welcome` (`src/routes/welcome.tsx:52` and `:143`). `getSafeRedirect`
returns the target when it passes, otherwise the caller's default.

The check is three conditions, not a general URL parser: the target must
be a string, must start with `/`, and must not start with `//` or `/\`.
Those last two are the interesting ones, because both are absolute URLs
to another origin once a browser normalises them — `//` as a
protocol-relative URL, and `\` as a forward slash. A relative value with
no leading slash, such as `dashboard`, is also rejected.

Worth knowing when reading the code: this is a deliberately narrow
allow-list, not a sanitiser that parses arbitrary URLs. It is sound for
the on-site destinations it is given, and it has unit tests covering
each branch.

## Upload gates

Two layers, and both live on the server.

### Content is sniffed, not declared

`src/lib/image-validation.ts` reads the leading bytes and accepts four
formats: PNG, JPEG, GIF, and WebP. **SVG is rejected on purpose**, since it
is a document format that can carry script.

Each format has a hand-written dimension reader — PNG big-endian `uint32`
at offsets 16 and 20, GIF little-endian `uint16` at 6 and 8, a JPEG SOF
marker walk, and the three WebP chunk types `VP8X`, `VP8L`, and the
lossy `VP8` chunk (which carries a trailing space in its four-character
name). Dimensions above `IMAGE_DIMENSION_LIMIT` (20 000 px) or implausible
values such as zero are rejected.

The stored object name is **regenerated**, never taken from the client:
`<kind>-<uuid>.<ext>`. A client-supplied name never reaches storage.

`src/lib/image-limits.ts` exports just the two ceilings a client
component needs — `IMAGE_MAX_BYTES` (8 MB) and `GALLERY_MAX_COUNT` (12).
The split is on purpose: the byte-parsing helpers in
`image-validation.ts` are server-only, and importing them from a client
component to read these two numbers would pull the whole parser into the
browser bundle.

### Filenames

`src/lib/upload-validation.ts` gates arbitrary uploads with
`FILENAME_MAX_LENGTH` (128) and `SAFE_FILENAME`
(`/^[A-Za-z0-9][A-Za-z0-9._+-]*$/`). The first character must be
alphanumeric, which rules out leading dots and hyphens in one rule. It
also rejects `..` explicitly and checks for ZIP magic (`PK\x03\x04`), since
this platform's payload is archives.

## Related

* [Resilience](../development/resilience.md) — chunk recovery, download
  counting, and connection caps
* [Object Storage](../storage/object-storage.md) — buckets, keys, quotas
* [Email and Password](../authentication/email-password.md) — why email
  verification is off, and what that means for account linking
* [Accessibility Standards](../accessibility/standards.md)
