# TODO

Current work items for the VoxelVein frontend. See [ROADMAP.md](ROADMAP.md)
for the longer-term plan.

## Before Production

* [ ] Legal pages — real operator name and address. `/legal` still
      renders `Unknown` for both, which is a § 5 DDG compliance gap. The
      contact address is now `admin@vomlabs.com` everywhere.
* [ ] Legal review by a qualified professional before production

## Content

* [ ] Project icons and gallery images in object storage
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

* [ ] Route-level tests for `/admin`, `/settings`, and `/dashboard`
* [ ] `admin.tsx` fetches badge counts client-side in a `useEffect` while
      every other route uses a loader
* [ ] `settings.tsx` `resolveTab` has a subtle three-way interaction
      (`tab`, legacy `passkeys` alias, `confirm=delete`) with no test
* [ ] `ProjectBrowser` is exempted from the complexity lint at ~800 lines;
      worth splitting search state from filters

## Planned

* [ ] Improve RBAC — more roles than "User" and "Admin"
* [ ] Per-route Open Graph tags and a sitemap
* [ ] `/status` and `/changelog` pages (the footer reserves the slots)
* [ ] Project reporting and abuse reports
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

## Known limitations

* [ ] **Images are not resized.** A 4000px phone photo is stored and served
      as-is, so a project icon can be several MB and every listing page that
      shows it pays for that. The 8 MB cap bounds the damage but does not
      remove it. Client-side downscaling is the cheap fix;
      `ROADMAP.md` has the full comparison including Cloudflare Image
      Resizing.
* [ ] **Image bytes pass through the app.** `/api/image/$imageId` proxies
      from the bucket rather than redirecting to it, because the
      published-state check has to run on every request. That makes image
      traffic count against Workers or container egress instead of being
      free at the CDN, as downloads are.
* [ ] **Search results show no icon.** `project_search` rows are built in
      SQL and do not carry image columns, so `toDocument` in
      `src/lib/search/projects.ts` fills in an empty gallery and a null
      icon. Search hit cards therefore fall back to the letter tile.
