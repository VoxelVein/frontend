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

## Post bodies are sanitized

A post body is author-written HTML as well as Markdown, and it reaches
the browser through `dangerouslySetInnerHTML`. Three things keep that from
being a cross-site scripting hole, and all three are load-bearing.

**It is sanitized before it is rendered, not when it is saved.**
`src/lib/sanitize.ts` walks the parsed Markdown tree and sanitizes the
`value` of every `html` and `inlineHtml` node, then hands the
already-cleaned document to the renderer. Sanitizing the rendered markup
instead would strip the class names on code blocks and the ids the
renderer adds for footnote links. Render-time sanitizing also means posts
written before this existed are covered, and the admin preview is
protected by the same code as the public page — there is no second path
to get wrong.

**The allowlist is deny-by-default.** `ALLOWED_TAGS` and `ALLOWED_ATTR`
name everything permitted; nothing is allowed because it was not
explicitly blocked. `FORBID_TAGS` and `FORBID_ATTR` repeat the critical
exclusions so the guarantee is auditable in one place rather than
inferred from the absence of an entry. All `aria-*` attributes are off
(`ALLOW_ARIA_ATTR: false`), as are `data-*`, `srcset`, and `style`.

**`inlineHtml` is handled explicitly.** The renderer has separate
injection sites for block `html`, inline `inlineHtml`, and a syntax
highlighter. A sanitizer that only knew the first would leave every piece
of inline author HTML in the document unsanitized — which in practice is
most of the HTML anyone writes. The tree also has four child collections,
not one: `children`, `items`, `header`, and `rows`. Table cells live in
`header` and `rows`, so a walk that only recurses through `children`
never reaches them.

URLs get two independent checks, because a Markdown link is never an HTML
node and so never reaches `sanitizeHtml`:

* `sanitizeHtml` handles URLs inside embedded HTML;
* `markdownUrlTransform` handles `[a](b)` and `![a](b)` at parse time.

Both reject `javascript:` however it is spelled — mixed case, leading
whitespace, or with control characters injected into the scheme, which
browsers strip before resolving it. `data:` URLs are allowed on `img`
only, restricted to base64 raster types (`avif`, `gif`, `jpeg`, `jpg`,
`png`, `webp`); `data:image/svg+xml` is rejected, because SVG is a
document format that can carry script.

`target` is stripped rather than allowed, since permitting it without a
global DOMPurify hook to add `rel="noopener"` would open links in a new
tab with a handle on `window.opener`.

The test suite asserts against the rendered DOM, not against HTML
strings. A string can satisfy a "no `<script`" check while still yielding
a live element once the browser parses it; asking the DOM what it actually
built cannot be fooled that way. `sanitize.test.ts` pins the sanitizer's
output and `markdown-body.test.tsx` pins the rendered result, including
that the legitimate markup a post is actually made of survives.

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

### Avatars

The avatar route (`src/routes/api/users.me.avatar.ts`) is the project image
route with the project replaced by the session's user, and it inherits every
gate above: byte sniffing, a regenerated filename, a server-derived
`users/{userId}/avatar/{uuid}.{ext}` key, and a quota enforced inside the
write rather than checked before it.

Avatars **count against the same site-wide quota** as project files.
`getUsedBytes` sums `user_images` alongside `project_files` and
`project_images`, so leaving them out would have let a few thousand
accounts fill the bucket past the configured ceiling without ever
tripping it. `insertAvatarWithinQuota` takes the same `QUOTA_LOCK_KEY` the
project path takes, so a project upload and an avatar upload cannot each
see room for themselves and overshoot together. It also nets off the
avatar being replaced, so swapping a large avatar does not need room for
both at once.

Two deliberate differences from project images:

The avatar of an account **waiting to be deleted** stays readable.
`/api/image/$imageId` hides a pending project's images, but a profile
byline already shows "Deleted user" for such an account; dropping its
avatar too would leave the byline's picture suddenly broken.

`users.image` is written with the new `/api/avatar/$id` URL. That is
Better Auth's existing avatar field, so the navbar, the account menu, and
the public profile all pick the upload up with no per-surface change — and
there is only one copy of the URL rather than one per component.

#### External picture URLs

An account can also point its picture at an image it hosts elsewhere, via
`setAvatarUrl` in `account.functions.ts`. That path is written to the same
`users.image` column rather than a new one, so every avatar surface reads
it without a per-surface change. It is not clobbered by a later Google or
GitHub sign-in: Better Auth's `overrideUserInfoOnSignIn` defaults to
`false`, so provider data is only used when the user record is created.

An external URL skips every upload gate above, because there are no bytes
to sniff — nothing is fetched, stored, or proxied, and the image is loaded
straight from the third party by the reader's browser. What replaces those
gates is `src/lib/avatar-url.ts`:

* **`https` only.** `http:` would be blocked as mixed content on an HTTPS
  site anyway, so accepting it would store a value that never renders and
  would send the reader's IP address to a third party in plaintext.
* **No other scheme.** `javascript:` and `data:` cannot execute from an
  `<img src>`, but a `data:` blob would let arbitrary bytes be pinned into
  every avatar surface on the site.
* **No credentials in the authority.** `https://user:pass@host/` leaks
  into logs, referrers, and anywhere the URL is rendered as text.
* **Not a bare origin**, which is almost always a truncated paste.

The server function re-parses the value rather than trusting its own
validator, so the boundary that decides what is stored reports the specific
reason. An empty field clears the picture rather than failing, so the field
can unset what it set.

`isSafeAvatarSrc` is the render-time half. Every `Avatar` — including the
ones in post bylines, which show a value the viewer did not choose — passes
through it, and anything that is neither an `/api/avatar/...` path nor an
`https:` URL renders as initials instead. That is not the control that
stops script; the allowlist above is. It exists so a value that reached
the column by some other route, such as an OAuth provider profile, renders
as a picture or as initials and never as a scheme nobody intended to allow.

Setting an external URL supersedes any uploaded avatar, so the stored
object and its `user_images` row are deleted in the same call. Leaving
them would charge the account quota for an object nothing references, and
the only way to reclaim it would be Remove — which would also discard the
URL just chosen.

### A file server that is missing, or down

Two failures that are both somebody else's fault, and which must not be
reported the same way.

**Not configured.** `loadStorageConfig` throws
`STORAGE_ERROR.notConfigured` when any `STORAGE_*` variable is missing.
The UI reads this through `storageIsConfigured` and greys out every
control that needs storage, with a tooltip and visible helper text saying
the admins have not configured it. The control is genuinely `disabled`
rather than dimmed: a dimmed button that still submits is worse than an
honest one, because the reader finds out it is broken by trying.

**Configured but unreachable.** `withStorageErrors` wraps every call that
talks to the endpoint and turns a connection failure into
`STORAGE_ERROR.unreachable`, matching on the error names Node and the AWS
SDK use — including `ENOTFOUND`, which is what a mistyped
`STORAGE_ENDPOINT` produces. A `StorageError` is never relabelled, so a
misconfiguration cannot be reported as an outage.

The API routes answer both with a machine-readable `code` alongside the
message. That is what lets the client choose its own wording instead of
string-matching "could not reach", which would quietly stop working the
moment somebody reworded the message — leaving the reader with a generic
failure and no prompt to report anything.

The client's own availability check **fails open**: a failed check leaves
the controls enabled and lets the action be sent. A cached `false` never
expires, so failing closed would mean one flaky request permanently greys
out uploads on a site whose storage is fine. The server refusing the
action, and saying why, is the better outcome.

### Filenames

`src/lib/upload-validation.ts` gates arbitrary uploads with
`FILENAME_MAX_LENGTH` (128) and `SAFE_FILENAME`
(`/^[A-Za-z0-9][A-Za-z0-9._+-]*$/`). The first character must be
alphanumeric, which rules out leading dots and hyphens in one rule. It
also rejects `..` explicitly and checks for ZIP magic (`PK\x03\x04`), since
this platform's payload is archives.

## Rate limits

`src/lib/rate-limit.ts` enforces a fixed-window budget per bucket, and
`src/lib/rate-limit-server.ts` is the thin shape a server function needs.

Counters live in **Valkey**, not in process memory. That is the whole
reason the store is shared: `web` and `api` both enforce limits, and a
per-process counter would be enforced separately by each replica,
multiplying the real limit by the number of them. Valkey is the
BSD-licensed Linux Foundation fork of Redis and speaks the same protocol,
so the client is the standard `redis` package — see
[Docker deployment](../deployment/docker.md) for the service and
`VALKEY_URL`.

The budget is deliberately coarse. The point is to stop a runaway client
or a script, not to enforce a product quota — nobody typing in a search
box comes near these numbers, while a loop over them does.

| Bucket        | Budget  | Where                                             |
| ------------- | ------- | ------------------------------------------------- |
| `auth`        | 10/min  | Reserved; sign-in and sign-up are Turnstile-gated |
| `read`        | 120/min | Project and post search, anonymous                |
| `download`    | 120/min | `/api/download/$fileId`                           |
| `sse-connect` | 30/min  | `/api/events`, catches reconnect storms           |
| `upload`      | 20/min  | Image and file uploads, per user                  |
| `write`       | 30/min  | Post create/update/delete, review decisions       |

Identity prefers the session's user id and falls back to the client
address, so a shared NAT does not throttle everyone behind it while an
anonymous visitor still has a bucket. Upload and write limits key on the
user id only: the thing being bounded is one account, which an address
cannot express.

The counter is incremented by a Lua script rather than `INCR` then
`EXPIRE`. Two commands leave a window where a crash between them leaves a
key with no TTL, and that key then counts forever. The script sets the
expiry only on the first hit, in one round trip.

### Fails open

If Valkey is unreachable the request is **allowed**, and the failure is
logged. A limiter that takes the site down when its store is down is a
worse outage than the abuse it prevents. Two things keep that from
becoming a hang:

* `getValkey` sets a bounded `connectTimeout` and disables reconnection.
  node-redis retries a refused connection with backoff by default, which
  would leave the caller — and the request waiting on it — pending long
  past any useful answer.
* A failed connect throws into the caller, and the next request builds a
  fresh client, so an outage self-heals without a restart.

In production the app refuses to start without `VALKEY_URL`, so the
"shared counters" path cannot be silently reduced to per-process
counters by a missing variable.

### Sign-in and sign-up

Those endpoints belong to Better Auth, so app code cannot wrap them. Two
things cover them instead.

Turnstile, which gates the credential and sign-up forms.

Better Auth's **own** limiter, configured as `rateLimit` in
`src/lib/auth.ts`. `customRules` set the tightest budgets in the app on
the paths that matter: 5/min on `/sign-in/email` and `/sign-up/email`,
3/min on the two mail-sending paths.

Its counters are in **process memory**, which is a real limitation and
worth stating plainly: on N replicas the effective limit is N times those
numbers. They still stop one runaway client, which is the job.

**Known gap — two tempting transports, both refused.** Everything outside
Better Auth's own endpoints uses Valkey, so it is natural to want it here
too. Both alternatives were tried and both broke sign-in:

`storage: "secondaryStorage"`
: Makes Better Auth treat the store as the **session** store. Its
  `findSession` then reads the session token from there and returns `null`
  when the key is missing, so every session that actually lives in
  Postgres becomes invisible. The symptom is silent and nasty: the cookie is
  still valid, every `/api/auth/*` call succeeds, and the UI simply stays
  signed out.

`storage: "database"`
: Runs Better Auth's runtime schema check, which rejected the table this
  project declares (`drizzle/0018_add_rate_limit.sql`) and turned **every**
  `/api/auth/*` request into a 500 with `Drizzle schema mismatch`. Resolving
  it needs the adapter's exact expected column set for the `rateLimit`
  model, which is not documented; the declared table is `count`, `id`,
  `key`, `lastRequest`, and `db.query` is keyed by the TS export name while
  the adapter looks the table up as `<model>s` under `usePlural`.

Both are recorded here so the next attempt starts from what broke rather
than from the idea. A rate limit is not worth breaking authentication
over; the per-process limit is the acceptable cost until the expected
schema is confirmed against the installed adapter.

### Circuit breaker

After a failed check the limiter stops calling Valkey for ten seconds and
allows everything in the meantime. Without it, one broken dependency would
cost **every** request on the site a connect attempt against a server that
is not answering — the opposite of what a rate limiter is for. A single
successful call closes it again, so recovery needs no restart.

## Related

* [Blog](../content/blog.md) — author-written HTML, and what it may contain
* [Resilience](../development/resilience.md) — chunk recovery, download
  counting, and connection caps
* [Docker deployment](../deployment/docker.md) — the Valkey service and
  `VALKEY_URL`
* [Object Storage](../storage/object-storage.md) — buckets, keys, quotas
* [Email and Password](../authentication/email-password.md) — why email
  verification is off, and what that means for account linking
* [Accessibility Standards](../accessibility/standards.md)
