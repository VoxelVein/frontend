# Changelog

All notable changes to the VoxelVein frontend are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and release
names match the repository's `ALPHA-*` git tags.

## [Unreleased]

### Added

* Project ownership transfers: owners re-authenticate to offer a project and
  the recipient accepts within seven days, while admins can move projects
  immediately. Both sides get notifications and a transfers inbox.
* A dedicated Top Voted Servers section on the home page, with timeframe tabs,
  a lead card and compact ranked rows.
* Compact vote counters on server cards, matching the online-player counter.

### Changed

* Server voting and its settings use shadcn components throughout, and the
  listener cards dim when voting is off.
* Long supported-version lists fold behind an expand button on the public
  server page and in the server manager.

### Fixed

* Server and query failures are announced with Sonner toasts instead of inline
  errors; field validation and not-configured notices stay inline.
* The "All versions" filter now matches the other browse filters' size.

## [ALPHA-0.17.0] - 2026-11-24

Changes on `main` since `ALPHA-0.16.1`.

### Added

* Server voting: players vote with a 24-hour rolling cooldown, and server
  owners can enable Votifier rewards (classic v1 or NuVotifier v2), test their
  listener and inspect the last 50 deliveries. Daily, weekly, monthly and
  all-time leaderboards are available on the home and browse pages.
* Reward tokens are encrypted at rest with AES-256-GCM using
  `VOTING_ENCRYPTION_KEY` and are never returned to the browser.
* A custom SVG cursor with an opt-in setting in Appearance, marked beta.
* Suggested Minecraft versions from Mojang in the server form, with Backspace
  in an empty field returning the last chip for correction.
* All project browse, detail and gallery pages under `/p/<type>/...`, with the
  old top-level URLs kept as redirects.
* Persistent admin warnings when Redis or object storage is not configured.

### Changed

* The project editor now uses a mini-sidebar instead of a row of tabs.
* Comparison statistics were refreshed for seven content types, and the legal
  notes state that no paid services are planned.
* The voting migration was renumbered to `0030_server_voting` so it follows
  `0029_project_disclosures`, and stash conflict markers left in the voting
  commit were resolved.

### Fixed

* Votifier review findings: IPv6 destinations are checked against the global
  unicast range, DNS is bounded by the five-second delivery deadline, failed
  v1 socket writes are reported as failures, service names are capped at
  162 UTF-8 bytes so a v1 packet fits one RSA block, tokens are decrypted only
  for v2 connections, and delivery status is reported instead of a misleading
  success flag. Votes are recorded as unconfirmed before delivery so a lost
  status write stays distinguishable from an unattempted one.
* Pre-existing lint, test and dependency errors were cleared.

## [ALPHA-0.16.1] - 2026-11-23

### Added

* Creator disclosures with seven types (AI-generated content, statistics,
  early access, fan content, personal content, translation and discontinued),
  validated in app code, stored in `projects.disclosures` as JSON, and shown
  in a Transparency section on public project pages.
* Passkey sign-in on the login page when the browser supports WebAuthn.
* A redesigned About page and an About link in the site navigation.
* Account destinations in the signed-in mobile drawer.
* Shared sidebar navigation for the settings and admin areas.

### Changed

* Refreshed the navbar, footer and news section animation.
* Avatars are cropped and stored as full squares; the logo is now a
  theme-aware inline SVG.

### Fixed

* Passkey sign-in is actionable instead of merely advertised.
* Images that cannot be decoded are reported rather than failing silently,
  and the crop window stays square behind a circular overlay.

## [ALPHA-0.16.0] - 2026-11-20

### Added

* Live server player counts on server cards, and richer review detail with
  descriptions, changelogs and files.
* A collapsible, responsive admin sidebar grouped into People, Content,
  Moderation and Support.
* Editable project slugs on the manage page.
* Side-by-side Markdown editing for project descriptions, release changelogs
  and profile bios.
* Per-route Open Graph and Twitter tags, a card-based news section, and admin
  post shortcuts on reader-facing blog pages.
* Prefixed and colourised web and API logs during development.

### Changed

* Routes were grouped and the tooling refreshed. The server-only database
  schema no longer pulls Drizzle's query builder into the client bundle.
* Blog posts now return a real 404, with the tailored view moved to a
  route-level `notFoundComponent`.
* Search error copy names the failing connection instead of a lost "search
  service".

### Fixed

* Review and project updates were corrected.
* Invalid or stale `?tab=` values fall back to the default admin tab.
* The development proxy forwards events, and authentication limits are
  explained in the guides.
* Usernames are required and authentication failures are reported.

## [ALPHA-0.15.0] - 2026-10-05

### Added

* Blog categories, multiple co-authors, XSS-safe rendered post HTML and member
  reports with a moderator inbox.
* A gallery page that 404s when a project has no images, and public profiles
  rebuilt around an identity card and stats.
* Custom profile pictures, shared Valkey-backed rate limits, and a rebuilt
  notification inbox with per-item mark-as-read.
* An account deletion wizard with a grace period, and a guided danger zone in
  settings.
* Indexes on seven foreign keys that PostgreSQL does not index by default.

### Changed

* Settings was reorganised: the username field merged into Profile, the bio
  has a live preview and character cap, and Save no longer claims unsaved
  changes after an edit was undone.
* Download-first project detail pages and tighter explore cards; server
  pages rebuilt around the join panel.
* Images are resized in the browser before upload, and the bundle budget,
  tracing tools and shared scroll-reveal observer were updated.

### Fixed

* Search escaped `ILIKE` wildcards that had never been escaped, so `100%` no
  longer matched every result containing "100".
* Settings tab resolution, username cooldown boundaries and the malformed
  timestamp path were covered and corrected.
* Republishing a project no longer requires review unless staff took it down.

## Earlier alpha releases

Releases before `ALPHA-0.15.0` include the initial project types,
moderated publishing, the move from Meilisearch to PostgreSQL full-text and
trigram search, object storage for images and files, the three-role ladder,
Cloudflare Turnstile, the ElysiaJS event server and the Node 24 toolchain.
See the git tags and history for the individual changes.
