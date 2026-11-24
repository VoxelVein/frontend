# TODO

Current work items for the VoxelVein frontend. See [ROADMAP.md](ROADMAP.md)
for the longer-term plan and [CHANGELOG.md](CHANGELOG.md) for what has
already shipped.

## Before Production

* [ ] Legal pages, real operator name and address. `/legal` still renders
      `Unknown` for both, which is a § 5 DDG compliance gap. The contact
      address is `admin@vomlabs.com` everywhere.
* [ ] Legal review by a qualified professional before production.

## Content

* [ ] Unpic integration once real content images exist.
* [ ] Email verification for password accounts. Without it, only social
      sign-ins and admins can publish.
* [ ] Password reset.
* [ ] Notification email for review decisions and deletion confirmations.
* [ ] Email change flow.

## Bugs and inconsistencies

* [ ] No `og:image`; `twitter:card` is `summary` rather than
      `summary_large_image`. The missing image is deliberate rather than
      pointing at a file that does not exist.
* [ ] `src/routes/admin/index.tsx` fetches badge counts client-side in a
      `useEffect` while every other route uses a loader.
* [ ] The server voting system has not been verified end to end. Its
      author noted this in the integrating commit; test a real vote, reward
      delivery, cooldowns and the leaderboards before relying on it.
* [ ] Votifier cannot confirm that an in-game reward was granted. Classic v1
      confirms only that bytes were written, and failed deliveries are not
      retried because the protocols have no idempotency key. Document this
      clearly for owners.

## Documentation

* [ ] Bring [ROADMAP.md](ROADMAP.md) up to date: it still lists passkey
      sign-in and project reporting as future ideas though both shipped, says
      "six project types" instead of seven, says the admin panel has seven
      tabs instead of nine, and records a 700 kB bundle budget while the
      enforced raw limit is 780 kB.
* [ ] Fix [docs/README.md](docs/README.md), which still describes "all six
      project types".
* [ ] [docs/content/server-voting.md](docs/content/server-voting.md) refers to
      migration `0029_server_voting`; the file was renumbered to
      `0030_server_voting`.
* [ ] Add `CHANGELOG.md` to `ROOT_FILES` in `scripts/check-doc-links.ts` so
      links in the changelog are checked like the other root documents.

## Quality

* [ ] Route-level tests for `/admin`, `/settings` and `/dashboard`. Five
      route shells are covered in `src/__tests__/`; these three are not.
      Settings' tab policy is tested in `settings-tabs.test.ts`, so what is
      missing there is the shell.
* [ ] Eight of the nine hooks in `src/hooks/` have no test. Only
      `custom-cursor` is covered, in `src/lib/__tests__/custom-cursor.test.ts`.
      `use-post-search` is in `coverage.include` despite having no test.
* [ ] `ProjectBrowser` is exempted from the complexity lint at roughly 850
      lines; split search state from filters.

## Planned

* [ ] FastStats integration: downloads from this and other providers, total
      servers, plugin versions and game versions in use.
* [ ] A sitemap.
* [ ] `/status` and `/changelog` pages (the footer reserves the slots).
* [ ] Creator analytics.
* [ ] Migrate the shadcn theme to the claymorphism preset.

## Completed

* [x] Rebuilt voting UI with shadcn primitives and shadcn-only form controls.
* [x] Announced server and query failures with Sonner toasts.
* [x] Folded long supported-version lists on the server page and manager.
* [x] Replaced the nested vote card on server cards with a compact counter.
* [x] Redesigned the homepage Top Voted Servers section and removed it from
      `/p/servers`.
* [x] Standardized the version at `ALPHA-0.17.0` and added a changelog.
* [x] Seven project types: browse, detail and gallery pages, creator forms,
      filters and search.
* [x] Unified all project pages under `/p/...` with redirect-only legacy
      routes and a shared page frame.
* [x] Server voting with Votifier v1/v2 rewards, cooldowns, leaderboards,
      encrypted tokens and hardened outbound delivery.
* [x] Creator disclosures with seven types and a public Transparency section.
* [x] Opt-in beta custom cursor, using a theme-aware SVG for the default
      pointer.
* [x] Mojang-backed suggested Minecraft versions with Backspace re-editing.
* [x] Admin warnings for unconfigured Redis or object storage, and removal of
      the public SSE-unavailable toast.
* [x] Project editor mini-sidebar and side-by-side Markdown editing.
* [x] Passkey sign-in on the login page and account links in the mobile
      drawer.
* [x] About page redesign, navbar and footer refresh, and square avatars with
      a shared cropper.
* [x] Collapsible admin sidebar, editable project slugs and live server
      player counts.
* [x] Server projects with join details, linked content and a derived client
      requirement.
* [x] Moderated publishing with an admin review queue.
* [x] Blog with admin post management, categories, co-authors and post search.
* [x] Public author profiles with a Markdown bio.
* [x] Postgres search replacing Meilisearch.
* [x] Account deletion flow with a grace period and hourly purge task.
* [x] Admin panel with nine tabs.
* [x] Project reporting with a closed reason list and a moderator inbox.
* [x] Role ladder (`user` / `moderator` / `admin`) replacing ad-hoc role
      checks.
* [x] Per-route Open Graph and Twitter tags on project, blog and profile
      pages.
* [x] Indexes on the seven foreign keys PostgreSQL never indexes for you.
* [x] Dropped the unused `posts.author_id` column; authors now live in the
      join table.
* [x] Search wildcard escaping, so `%` and `_` are literal again.
* [x] Docker multi-stage build and dev, prod and host-port Compose overrides.
* [x] `justfile` and `mise.toml` with Node 24 across the repository.

## Known limitations

* [ ] **Resizing is client-side only.** `src/lib/image-resize.ts` runs in the
      browser before upload, so the full-size original never reaches the
      bucket. Anything posting straight to `/api/projects/$id/images`
      bypasses it and stores up to 8 MB as sent. Server-side resizing would
      close that at the cost of a native dependency and CPU per upload.
* [ ] **GIFs are never resized.** Canvas cannot preserve animation frames, so
      a GIF under the 8 MB cap can be the largest object in the bucket.
* [ ] **Image bytes pass through the app.** `/api/image/$imageId` proxies from
      the bucket rather than redirecting, because the published-state check
      has to run on every request. Image traffic counts against egress.
* [ ] **Search results show no icon.** `project_search` rows are built in SQL
      without image columns, so search cards fall back to the letter tile.
* [ ] **Voting needs a Node runtime with TCP support.** Outbound DNS and TCP
      are required, destinations are pinned to public addresses, and
      production voting fails closed without Turnstile and shared rate
      limiting behind a trusted proxy.
