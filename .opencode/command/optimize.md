---
description: Review VoxelVein code for authorization, security, performance, and WCAG 2.2 AA regressions, then apply approved fixes
tags: [review, security, performance, accessibility, database]
---

# Optimize

Review VoxelVein frontend code for defects that matter in this specific
codebase, then fix what is approved.

```
/optimize [file | directory | glob]
```

`$ARGUMENTS` is the scope. With no argument, use the working-tree diff plus
the files touched by the last few commits:

```bash
git status --short
git diff --name-only HEAD~5..HEAD
```

## Scope discipline

Report first, edit second. Produce the findings list, wait for approval,
then fix one finding at a time. Never apply changes while still auditing.

Division of labor with the other commands:

- `/clean` owns mechanical lint, format, and debug-statement removal
- `/web-design-guidelines` owns the full a11y and UI review
- `.opencode/skills/performance-guidelines/SKILL.md` owns deep perf analysis

This command covers what those miss: access control, upload and storage
boundaries, query and index efficiency, SSR data flow, and error handling.
Load the performance skill only when the review surfaces a real hot path
rather than duplicating its checklist here.

## Stack map

Check each finding against the layer the code actually lives in.

| Layer | Location | Notes |
| --- | --- | --- |
| File routes | `src/routes/*.tsx` | SSR; loaders run on the server |
| Server functions | `src/lib/*.functions.ts` | `createServerFn`, session-guarded |
| API route handlers | `src/routes/api/*.ts` | Public HTTP surface, own guards |
| API server | `server/routes/*.ts` | Elysia on `:3002` |
| Bootstrap | `server/index.ts` | CSP, referrer, nosniff, CORS |
| Client data and state | `src/hooks/`, `src/components/` | Query, Pacer, Virtual |
| Shared domain logic | `src/lib/*.ts` | Pure helpers, no route imports |
| DB schema | `src/db/schema.ts`, `drizzle/` | Drizzle + Postgres |
| Search | `src/lib/posts-index.ts`, `search-sync.ts` | Meilisearch |
| Storage | `src/lib/storage.ts`, `storage.functions.ts` | S3-compatible + presigned |
| Tests | `src/**/__tests__/` | Vitest + Testing Library |

## What to check

### 1. Authorization

- Every `createServerFn` handler must authenticate. Expect
  `ensureSession`, `requireAdmin`, `requireUploader`, or
  `requireEditableProject` before the first read or write. A handler that
  goes straight to `db` is a finding.
- `requireAdmin` guards admin mutations such as the post CRUD in
  `posts.functions.ts` and the admin list pages under `src/components/admin/`.
  Admin search intentionally runs against Meilisearch directly because the
  public route cannot verify a session; keep that filter hardcoded to
  published-only so drafts can never reach an anonymous caller.
- Handlers under `src/routes/api/` do not inherit the server-function guards.
  Each one needs its own check: `download.$fileId.ts`,
  `projects.$projectId.versions.$versionId.files.ts`, and `auth/$.ts`.
- A handler that reads an id out of its input and trusts it is the highest
  severity finding in this codebase. Trace the id to a lookup that joins
  back to the session's user, not just to a row.
- New capabilities belong in `src/lib/permissions.ts` behind the `ac` access
  control, not an ad-hoc role check inline.
- Validate path params before use. `download.$fileId.ts` parses `fileId`
  through a Valibot `uuid()` pipe and returns 404 on failure; a new route
  must do the same before it reaches a query.

### 2. Upload and storage boundaries

- `src/lib/upload-validation.ts` is the single allowlist: `ALLOWED_EXTENSIONS`
  is `.jar`, `JAR_CONTENT_TYPE`, `hasZipMagic` on the leading bytes,
  `sanitizeFilename`, and `FILENAME_MAX_LENGTH` of 128. A new upload path
  imports these rather than re-implementing them.
- Client checks in `src/lib/upload-client.ts` are UX only. The server must
  re-validate; treat any client-side gate as absent.
- `peekStream` must stay a bounded read. Replacing it with a full
  `arrayBuffer()` on a user-supplied jar is a memory-exhaustion vector.
- Quota has to be enforced inside the write via `insertFileWithinQuota`, not
  checked and then inserted, or concurrent uploads race past the limit.
- Storage keys are built server-side from the sanitized filename plus an id.
  A key taken verbatim from a request body is a finding.
- `isDuplicateFilenameViolation` and `DuplicateFilenameError` are the
  expected-error path for the unique index. Do not pre-check existence to
  avoid them; that reintroduces the race.

### 3. Injection and rendering

- Drizzle queries use bound parameters: `eq`, `inArray`, and the `sql` tagged
  template. String-concatenated SQL is a finding.
- User input in a `like`/`ilike` pattern needs `%` and `_` escaped.
- Meilisearch filters must be built as an array of validated clauses.
  Interpolating a raw query into a filter expression is a finding.
- Blog bodies render Markdown through `@tanstack/markdown`. Any
  `dangerouslySetInnerHTML` needs a sanitization comment justifying it; the
  codebase currently has none, and adding one is a review event.
- `env.config.ts` and `server/env.ts` validate with Valibot. Error messages
  must not echo a secret value back to the caller or the log.

### 4. Secrets and transport

- `DATABASE_URL`, `BETTER_AUTH_SECRET`, `MEILI_MASTER_KEY`, storage
  credentials, and `TURNSTILE_SECRET` stay server-side. Only
  `VITE_GITHUB_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` are public, because
  `env.config.ts` maps them deliberately. A new `VITE_` value must be
  public by definition.
- Security headers are set globally by the `onRequest` hook in
  `server/index.ts`. A route that bypasses the hook, or that builds its own
  weaker `Content-Security-Policy`, is a finding.
- `CORS_ORIGIN` must be an explicit origin list. A `*` combined with
  credentials is a finding.
- `rel="noopener"` on every `target="_blank"`. No `eval()`. No direct
  `document.cookie` writes.
- There is no rate limiting anywhere in the app today. `download.$fileId.ts`
  dedupes counts per client key but does not limit request volume, and the
  public `/api/projects/search` and webhook routes are unthrottled. Call
  this out as a known gap rather than a surprise, and treat a new public
  endpoint as needing a decision about limits.

### 5. Queries, indexes, and cache

- N+1: a `for` loop awaiting a Drizzle query per iteration. Batch with
  `inArray`.
- A query that filters or sorts on a column with no index in
  `src/db/schema.ts` is a finding. Schema changes need a generated
  migration in `drizzle/NNNN_*.sql` plus its meta snapshot.
- `.orderBy` or `.limit` without `.where` reads the whole table.
- Project search is capped at `PAGE_SIZE` of 12 with `MAX_PAGE` of 1000 in
  `server/routes/projects.ts`. Admin post search caps at 50. Both are
  deliberate bounds; raising one needs an argument about index cost.
- `src/lib/project-search-cache.ts` is a 60s TTL, 50-entry LRU keyed by a
  serialized params tuple. A new cached read extends this module rather than
  starting a parallel cache.
- Meilisearch and Drizzle must stay in step. `search-sync.ts` and
  `posts-index.ts` own the write side; `pnpm db:reindex:posts` is the repair
  path. A new searchable field needs an index settings change and a reindex,
  otherwise search silently returns nothing for it.

### 6. Rendering and data flow

- React Compiler is not enabled. Memoize only where it measurably matters,
  and keep the existing `oxlint-disable-next-line
  react-doctor/react-compiler-no-manual-memoization` justification when
  `useCallback` stabilizes a search effect.
- Search inputs debounce with `useDebouncedValue` from
  `@tanstack/react-pacer/debouncer` at 300ms, in both
  `src/components/projects/project-browser.tsx` and
  `src/hooks/use-post-search.ts`. A new search field follows the same
  pattern; a hand-rolled `setTimeout` debounce is a finding.
- Search responses can arrive out of order. `use-post-search.ts` already
  discards superseded responses and exposes an availability probe that
  deactivates the field when Meilisearch is down. A new search hook without
  that guard is a finding.
- Every subscription, observer, and timer needs a cleanup. Missing cleanup in
  a search or SSE hook leaks listeners across route changes.
- Data belongs in a route loader or a Query call. Fetching from `useEffect`
  on first paint throws away SSR and produces a loading flash.
- Pacer and Virtual hooks are not reactive by default. Pass a `selector` when
  a component must re-render on pending or virtual state.

### 7. Bundle and dependency cost

- `pnpm check:bundle` enforces 700 kB raw and 250 kB gzip on the client entry.
  Run it before proposing any new dependency, and treat a budget breach as a
  blocking finding rather than a rounding error.
- `@tanstack/react-pacer`, `@tanstack/react-virtual`, and
  `@tanstack/react-charts` are already installed. Prefer them over a new
  library. `useVirtualizer` currently appears only in the admin users and
  sessions tables; a paginated list of 12 or 50 does not need it.
- No barrel files, no namespace imports, no `import * as`. Use specific
  imports so tree-shaking can drop unused code.
- Give every `<img>` explicit `width` and `height` to avoid layout shift.
  `@unpic/react` is not installed; only add it once CDN-backed content
  images actually exist.

### 8. Accessibility regressions

WCAG 2.2 AA is a baseline here, so a change that breaks it is a regression
even when the code is otherwise correct.

- Colors come from OKLCH semantic tokens: `--primary`, `--muted-foreground`,
  `bg-card`, `bg-muted`, `destructive`. Raw hex or an arbitrary gray is a
  finding, and contrast has to hold in both themes.
- Interactive elements keep a visible focus ring
  (`focus-visible:ring-3 focus-visible:ring-ring/50`). Removing `outline`
  without a replacement is a finding.
- Dialogs, drawers, and menus must be keyboard operable, close on `Esc`, and
  return focus to the trigger. Prefer the Base UI `Dialog` and `Drawer`
  primitives over hand-rolled focus traps.
- Loading states use `aria-busy` skeletons rather than blank flashes. Errors
  use `role="alert"` or `aria-live="polite"`.
- Inputs need a real `<label>`, and validation errors need `aria-invalid`
  plus `aria-describedby`.
- Touch targets are at least 44x44px.
- Motion stays under 400ms, animates only `transform` and `opacity`, and
  respects `prefers-reduced-motion` through `usePrefersReducedMotion()` and
  `EASE_OUT_CSS` from `src/lib/ease.ts`.
- One `<main>` per page, no skipped heading levels, and an `aria-label` on a
  second `<nav>`.

### 9. Error handling and resilience

- No `console.log`, `debugger`, or `alert` in shipped code. `console.error`
  only where the failure is otherwise invisible.
- A `catch` that only rethrows is noise. Handle it or let it propagate.
- Throw `new Error(...)` naming the operation that failed, and pass the
  original as `cause` so the stack survives. `project-search.functions.ts`
  shows the pattern.
- Meilisearch, Postgres, and S3 all fail in practice. Search, upload, and
  webhook paths need an explicit failure state. The existing degradation
  pattern returns `available: false` and hides the search field; a new
  search path should follow it rather than throwing into the render.
- `server/routes/events.ts` is SSE. A client reconnect or disconnect must not
  leak a listener, and the heartbeat interval needs a matching clear.
- `download.$fileId.ts` swallows a failed session lookup on purpose so an
  anonymous download still works. That is a deliberate tradeoff; keep it and
  do not report it as a swallowed error.

## Rules

- Every finding needs a concrete failure mode: a wrong result, a data leak,
  a broken keyboard path, or a measurable cost. Style preferences are not
  findings.
- Never disable an Oxlint rule, delete a test, or weaken an assertion to
  make a check pass.
- No speculative refactors and no drive-by renames. Stay inside the
  reviewed scope.
- If a check is already automated, say so instead of duplicating it by hand.
- Report an existing gap as a gap. Do not present a known limitation as a
  newly discovered defect.
- Add a test alongside any behavioral fix.

## Report format

Group by severity, then by file, one entry per finding, terse `file:line`
format:

```text
CRITICAL  src/lib/posts.functions.ts:142
  deletePost takes postId from its input and never calls requireAdmin, so any
  signed-in session can delete any post. Route it through requireAdmin before
  the delete. Failure: unauthorized content loss. Guard: requireAdmin
```

Close with a summary table of severity counts and the gate each fix needs to
verify. If a section found nothing, say so in one line rather than omitting
it, so the reviewer knows it was checked.

## Apply and validate

After the findings list is approved:

1. Fix one finding at a time, smallest blast radius first.
2. Re-run the gates that cover the change, then the full set before
   reporting done:

   ```bash
   pnpm check        # Ultracite: Oxlint + Oxfmt, read-only
   pnpm typecheck    # tsc --noEmit
   pnpm test         # Vitest
   pnpm build        # Vite + Nitro
   pnpm check:bundle # 700 kB raw / 250 kB gzip budget
   ```

3. Re-run the full set once after the last fix, not after every edit.
4. When a finding touches interaction, walk the path with the keyboard and
   confirm focus order, `Esc`, and focus return.
5. Report what changed, which gate proved it, and anything deliberately left
   undone.
