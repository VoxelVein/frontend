# Resilience

Where the app absorbs a bad condition instead of surfacing an error: a
stale chunk after a deploy, a link prefetch masquerading as a download,
and a proxy that lies about client IPs.

## Chunk reload recovery

A browser remembers a failed dynamic import for the lifetime of the page.
After one network blip, or after a deploy replaced the chunk files under a
visitor's feet, every later navigation to that route fails the same way
until a full reload. Nothing recovers on its own.

`src/lib/chunk-reload.ts` reloads the page once, bounded by time.

`isChunkLoadError` matches four message shapes, one per engine plus Vite's
preload helper: Chromium's `Failed to fetch dynamically imported module`,
Firefox's `error loading dynamically imported module`, Safari's `Importing
a module script failed`, and `Unable to preload CSS`.

`reloadForChunkError(href)` reads a timestamp from `sessionStorage` under
`voxelvein:chunk-reload`. If the last reload was less than
`CHUNK_RELOAD_COOLDOWN_MS` (10 s) ago it returns `false` and the original
error surfaces, because reloading that fast means the reload is not
helping.

Two details worth keeping:

* The storage is **`sessionStorage`, not `localStorage`**, so the marker
  dies with the tab. It is a per-tab guard, not a per-browser one.
* The timestamp is **never cleared** on success. The cooldown is
  therefore time-based rather than attempt-based: a user who hits a chunk
  error can still be reloaded once more after 10 s. This deliberately
  layers on top of TanStack Router's own once-per-tab-session reload,
  which gives up too early.

It is wired to Vite's `vite:preloadError` window event in
`src/router.tsx`, with `event.preventDefault()` so the default error page
does not also appear.

The environment is injectable (`now`, `navigate`, `storage`), which is why
the module has unit tests rather than needing a browser.

## Download counting

Downloads are a running total, so they need defending against things that
look like downloads but are not, and against a single client inflating
them.

`src/routes/api/download/$fileId.ts` responds with a `302` to a
pre-signed storage URL and `cache-control: no-store`. No content is
proxied through the app; the redirect target is fetched directly from
storage.

Counting is skipped in two cases.

**Prefetch requests.** `isPrefetchRequest` reads `sec-purpose`, `purpose`,
and `x-moz` and looks for `prefetch` or `prerender`. Speculative fetches
still download, so without this a browser warming links on the listing
pages would inflate totals for free.

**Repeat clients.** `createDownloadDeduper` counts each
`(client, file)` pair at most once per 24 h window, in memory. The Map is
keyed so that insertion order is expiry order, and it evicts on read. It
is capped at `DEFAULT_MAX_ENTRIES` (50 000), evicting the oldest key when
full. Under heavy load the window is therefore approximate rather than
exact, which is a deliberate trade for a fixed memory ceiling.

The client key is `user:<id>` when signed in, else `ip:<addr>`, else the
literal `anonymous`. A failed session lookup is swallowed rather than
allowed to block the download.

### Two things that bite here

`TRUST_PROXY` is read **once at module scope**
(`src/routes/api/download.$fileId.ts:16`). Changing it needs a process
restart, and setting it `true` without a proxy that sets
`X-Forwarded-For` lets any client forge its own key.

With `TRUST_PROXY` off behind a proxy, every anonymous visitor shares the
`ip:127.0.0.1` bucket, so only their first download per file per day
counts. The deduper is still doing its job — stopping a request loop from
inflating totals — but anonymous counts become a large undercount. See
[Docker](../deployment/docker.md#client-ips-behind-a-reverse-proxy) for the
correct setting behind Traefik.

The increment runs in one transaction across the version and the project,
and deliberately **preserves `projects.updatedAt`**. Downloads drive the
default search sort, but they are not a project update, so churning
`updatedAt` would reorder and re-date projects that nobody edited.

## The download gate

Before any of that, the route answers `404` for a `fileId` that is not a
UUID, does not exist, or belongs to a project that is not `published` or
is `pendingDeletion`. Unpublished files are therefore unreachable by URL
even though the storage key is knowable, which is the property that makes
the redirect safe to hand out.

## Concurrent connections

The SSE endpoint caps live connections per client and refuses the
overflow (`server/routes/events.ts`). Like the download deduper, the client
key depends on `getForwardedClientIp`, so the same `TRUST_PROXY` setting
governs it.

The two consumers read that variable differently, which is deliberate.
`readTrustProxy` (`src/lib/client-key.ts:7`) **throws** in production
unless the value is exactly `true` or `false`, so the event stream cannot
boot with the setting undecided — an unset value would otherwise let one
client take every slot. It warns instead when production sets it explicitly
to `false`, which is a deliberate "no per-client limits" choice. The
download route compares `process.env.TRUST_PROXY === "true"` directly and
so stays lenient: a web request failing on a missing variable is worse
than one that undercounts.

See [API Server](../architecture/api.md) for the event stream itself.

## Related

* [API Server](../architecture/api.md) — routes, SSE, and webhooks
* [Projects and Files](../content/projects.md) — files and versions
* [Hardening](../security/hardening.md) — headers, CSRF, and upload gates
* [Docker](../deployment/docker.md) — `TRUST_PROXY` and reverse proxies
