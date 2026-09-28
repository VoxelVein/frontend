# TODO

Current work items for the VoxelVein frontend. See [ROADMAP.md](ROADMAP.md)
for the longer-term plan.

## In Progress

* [ ] Legal pages — real operator name, address, and a single consistent
      contact address. `/legal` still renders `Unknown`; `privacy.tsx` and
      `terms-of-use.tsx` name a personal Gmail while `legal.tsx` names
      VOMLabs.
* [ ] Legal review by a qualified professional before production
* [ ] Update README, docs, ROADMAP, and TODO (this pass)

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
* [ ] `dashboard.projects.index.tsx` says "the mods and plugins you
      publish" — the platform supports six types
* [ ] `VerificationNotice` has the same two-type narrowing
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
* [ ] Loading skeletons and empty states across any remaining page
* [ ] Use `cn` more across the application
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
