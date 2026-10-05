# TODO

Current work items for the VoxelVein frontend. See [ROADMAP.md](ROADMAP.md)
for the longer-term plan.

## Before Production

* [ ] Legal pages — real operator name and address. `/legal` still
      renders `Unknown` for both, which is a § 5 DDG compliance gap. The
      contact address is now `admin@vomlabs.com` everywhere.
* [ ] Legal review by a qualified professional before production

## Content

* [ ] Unpic integration once real content images exist
* [ ] Email verification for password accounts (blocks uploads for
      non-social sign-ups)
* [ ] Password reset
* [ ] Notification email for review decisions

## Bugs and inconsistencies

* [ ] `Hero` advertises "Datapacks" in its rotating text, but there is no
      `datapack` project type, route, or category
* [ ] `project-browser-loader.ts` error copy still says "the search
      service" and suggests `pnpm dev:all`; search is in Postgres
* [ ] `/blog/$slug` returns a soft 404 (HTTP 200) while `/u/$username`
      returns a real one for the same class of miss
* [ ] `explore-section.tsx` copy says "watch the rest land" although all
      six categories are live
* [ ] `src/components/ui/separator.tsx` is unused
* [ ] No `og:image`; `twitter:card` is `summary` rather than
      `summary_large_image`
* [ ] `og:url` and the Twitter tags are static, with no per-route values
      on project or blog pages

## Quality

* [ ] Route-level tests for `/admin`, `/settings`, and `/dashboard`. Four
      route shells are covered in `src/__tests__/`; these three are not.
      Settings' tab policy is tested on its own in `settings-tabs.test.ts`,
      so what is missing there is the shell, not the logic.
* [ ] `admin.tsx` fetches badge counts client-side in a `useEffect` while
      every other route uses a loader
* [ ] None of the five hooks in `src/hooks/` have a test:
      `use-post-search`, `use-username-availability`, `use-storage-available`,
      `use-refresh-session`, `use-prefers-reduced-motion`. `use-post-search`
      is in the `coverage.include` list despite having no test importing it.
* [ ] Drop `posts.author_id`. Nullable and unwritten since `0018`, and the
      follow-up is already spelled out in `docs/content/blog.md`. It cannot
      go in the next release: migrations apply when the new code merges while
      the previous deploy is still inserting into the column, so this needs a
      release where no live instance still writes it.
* [ ] `ProjectBrowser` is exempted from the complexity lint at ~800 lines;
      worth splitting search state from filters

## Planned

* [ ] Per-route Open Graph tags and a sitemap
* [ ] `/status` and `/changelog` pages (the footer reserves the slots)
* [ ] Creator analytics

## Completed

* [x] All six project types: browse pages, detail pages, creator forms
* [x] Server projects with join details, linked content, and derived
      client requirement
* [x] Moderated publishing with an admin review queue
* [x] Blog with admin post management and post search
* [x] Public author profiles with a Markdown bio
* [x] Postgres search replacing Meilisearch
* [x] Account deletion flow with grace period and hourly purge task
* [x] Admin panel with seven tabs
* [x] Docker multi-stage build, Compose dev/prod/host-port overrides
* [x] justfile and mise.toml (Node 24)
* [x] Navbar polish (active states, user menu, mobile drawer)
* [x] Dev commands: `pnpm dev` / `dev:all` / `dev:web`
* [x] Repo-wide Node 22 → 24 consistency
* [x] README, ROADMAP, TODO, and `docs/` brought up to date
* [x] Personal Gmail replaced with `admin@vomlabs.com` on the legal pages
* [x] Dashboard and verification copy no longer narrows to two types
* [x] Loading skeletons for the home page and both dashboard project routes
* [x] `EmptyState` for the two bare version-list placeholders
* [x] `cn` pass: `FormError`, `RowIcon`, `MICRO_LABEL_CLASS`, and the
      `buttonVariants({ className })` call
* [x] Project icons and gallery images in object storage, served through
      `/api/image/$imageId`
* [x] Role ladder (`user` / `moderator` / `admin`) replacing 21 ad-hoc
      `role === "admin"` checks and four duplicated guard helpers
* [x] Project reporting with a closed reason list and a moderator inbox
      (`resolved` and `dismissed` kept apart)
* [x] Indexes on the seven foreign keys that had none. Postgres never creates
      these, so deleting a project was scanning every notification and report
      ever filed about it. `foreign-key-indexes.test.ts` now fails on any new
      one, in either direction — unindexed key, or an index left behind by a
      dropped column
* [x] Settings tab resolution extracted to `src/lib/settings-tabs.ts` and
      tested — the `tab` / legacy `passkeys` / `confirm=delete` interaction,
      plus the case where a tab and `confirm` disagree
* [x] Account deletion wizard: reducer, `sessionStorage` handshake, and the
      return-from-re-authentication resume
* [x] Search wildcard escaping. The `ILIKE` branches escaped nothing: written
      with single backslashes inside a tagged template, all four `replace`
      arguments collapsed, so `100%` matched every row containing "100" and
      `light_bearer` matched `lightxbearer`, while a query containing a
      backslash matched nothing at all

## Known limitations

* [ ] **Resizing is client-side only.** `src/lib/image-resize.ts` runs in the
      browser before upload, so the full-size original never reaches the
      bucket. That is where the saving is, but it means anything that posts
      straight to `/api/projects/$id/images` bypasses it and stores whatever
      it sends, up to the 8 MB cap. A server-side resize would close that, at
      the cost of a native dependency and CPU per upload.
* [ ] **GIFs are never resized.** Canvas cannot preserve animation frames,
      so a GIF is stored as uploaded. An animated GIF under the 8 MB cap can
      still be the largest object in the bucket.
* [ ] **Image bytes pass through the app.** `/api/image/$imageId` proxies
      from the bucket rather than redirecting to it, because the
      published-state check has to run on every request. That makes image
      traffic count against Workers or container egress instead of being
      free at the CDN, as downloads are.
* [ ] **Search results show no icon.** `project_search` rows are built in
      SQL and do not carry image columns, so `toDocument` in
      `src/lib/search/projects.ts` fills in an empty gallery and a null
      icon. Search hit cards therefore fall back to the letter tile.
