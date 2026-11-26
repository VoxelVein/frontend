# Changelog

All notable changes to the VoxelVein frontend are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and release
names match the repository's `ALPHA-*` git tags.

## [Unreleased]

## [ALPHA-0.18.0] - 2026-11-26

Changes on `main` since `ALPHA-0.17.0`.

### Added

* Player reviews on project and server pages: a five-star selector with an
  optional short comment, a newest-first list and a mean rating. Projects can
  be reviewed five seconds after a download; servers need no download.
* Blog post comments for signed-in readers, with replies to any comment shown
  as an indented thread. The project creator may answer each review once; no
  other account may respond.
* Staff-only hearts on comments and review responses. Staff names are tinted
  and carry a shield beside them; blocked words are rejected inline and at the
  write boundary.
* A full `/notifications` inbox with unread/read filters, search, Read all and
  Clear read. It has its own list design in a single Card with a CardHeader,
  rather than repeating the popup's rows. The popup links to it instead of
  offering a bulk action.
* A redesigned `/dashboard/transfers` inbox with Incoming/Outgoing tabs, search,
  a CardHeader, and confirmation-gated Accept all and Deny all actions.
* A small account button fixed to the bottom-right corner: hover shows the
  signed-in name in a tooltip, click opens the account menu.
* Project ownership transfers: owners re-authenticate to offer a project and
  the recipient accepts within seven days, while admins can move projects
  immediately. Both sides get notifications and a transfers inbox.
* A dedicated Top Voted Servers section on the home page, with timeframe tabs,
  a lead card and compact ranked rows.
* Compact vote counters on server cards, matching the online-player counter.

### Changed

* The navbar reads Home, Products, Blog. Products groups Mods and Plugins with
  a Browse submenu for the remaining project types.
* The account popup was simplified to one shared row style, and the avatar moved
  out of the navbar into the corner dock. The corner button is the picture with
  a thin outline and no background. The bell stays in the navbar.
* The footer is now a compact two-row bar, with the Discord invite in the social
  row, the quick links and the closing line. The "Top" link is gone.
* The corner avatar is larger, shrinks while pressed and opens the menu when the
  pointer is released rather than on press.
* The cookie consent banner is gone. The cookie policy page stays linked from
  the footer, and the site no longer stores a consent choice.
* The browse filter panel now uses shadcn controls with visible field labels,
  an active-filter count and a one-click reset. Search state lives in a focused
  hook over tested pure helpers, so the page no longer carries a complexity
  exemption.
* Browse pages fade and lift their filter panel, result cards and live banner in
  once, respecting reduced motion. The redundant total badge is gone; the
  accessible "found" summary remains.
* Server voting and its settings use shadcn components throughout, and the
  listener cards dim when voting is off.
* Long supported-version lists fold behind an expand button on the public
  server page and in the server manager.

### Fixed

* Server and query failures are announced with Sonner toasts instead of inline
  errors; field validation and not-configured notices stay inline.
* The "All versions" filter now matches the other browse filters' size.
* Notification load failures show the server message with one retry action in
  the card, instead of a split error block and a stale toast.
* The supported-versions fade on public server pages uses the card surface
  colour instead of black; the manage page keeps its own darker fade.
* The public voting card is hidden unless voting is enabled and its listener is
  fully configured, so an unfinished setup is not advertised to visitors.
* Development warnings: the dev script no longer spawns pnpm through a shell,
  aborted SSE streams no longer print `ECONNRESET` stack traces, and legacy
  `sslmode` aliases are normalised before `pg` reads the connection string.

### Tooling

* Upgraded pnpm from 11.3.0 to 12.23.0, including the setup action and docs.

## [ALPHA-0.17.0] - 2026-11-24

Changes on `main` since `ALPHA-0.16.1`.

### Added

* Server voting with a 24-hour rolling cooldown. Owners can enable Votifier
  rewards with classic v1 or NuVotifier v2, test their listener and inspect the
  last 50 deliveries. Daily, weekly, monthly and all-time leaderboards appear
  on the home and browse pages.
* Reward tokens are encrypted at rest with AES-256-GCM using
  `VOTING_ENCRYPTION_KEY` and are never returned to the browser.
* A custom SVG cursor, opt-in from Appearance and marked beta.
* Suggested Minecraft versions from Mojang in the server form, with Backspace
  in an empty field restoring the last chip for correction.
* All project browse, detail and gallery pages under `/p/<type>/...`, with
  persistent admin warnings when Redis or object storage is not configured.

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

### Documentation

* The comparison figures and the no-paid-services statement were updated.

## [ALPHA-0.16.1] - 2026-11-23

Changes on `main` since `ALPHA-0.16.0`.

### Added

* Creator disclosures with seven types (AI-generated content, statistics,
  early access, fan content, personal content, translation and discontinued),
  validated in app code, stored in `projects.disclosures` as JSON, and shown
  in a Transparency section on public project pages.
* Passkey sign-in on the login page when the browser supports WebAuthn.
* A redesigned About page and an About link in the site navigation.
* Account destinations in the signed-in mobile drawer.
* Shared sidebar navigation for the settings and admin areas.
* Avatars are cropped and stored as full squares, and the logo is now a
  theme-aware inline SVG.

### Changed

* The navbar, footer and News section animation were refreshed.

### Fixed

* Passkey sign-in is actionable instead of merely advertised.
* Images that cannot be decoded are reported rather than failing silently,
  and the crop window stays square behind a circular overlay.
* The upload client accepts any 2xx response instead of only 201.

## [ALPHA-0.16.0] - 2026-11-20

Changes on `main` since `ALPHA-0.15.0`.

### Added

* A collapsible, responsive admin sidebar grouped into People, Content,
  Moderation and Support.
* Editable project slugs, richer review detail with descriptions, changelogs
  and files, and live server player counts on server cards.
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

### Fixed

* Review and project updates were corrected.
* Search error copy names the failing connection instead of a lost "search
  service".
* Usernames are required and authentication failures are reported.
* The development proxy forwards events, and authentication limits are
  explained in the guides.

### Tooling

* Dependency groups were bumped and an unused Dependabot configuration was
  disabled. The auth-client mock uses the string form Vitest expects.

## [ALPHA-0.15.0] - 2026-10-05

Changes on `main` since `ALPHA-0.12.1`.

### Added

* PostgreSQL full-text and trigram search replaced Meilisearch, so escaped
  `ILIKE` wildcards no longer make `100%` match unrelated results.
* Modpacks, resource packs, shaders and servers were added, with a searchable
  version picker and client-requirement filters.
* Projects are reviewed before publication, and republishing no longer needs
  review unless staff took the project down.
* Blog categories, multiple co-authors, XSS-safe rendered HTML and member
  reports with a moderator inbox.
* A gallery page that 404s when a project has no images, and public profiles
  rebuilt around an identity card and stats with Markdown bios.
* Custom profile pictures, shared Valkey-backed rate limits, and a rebuilt
  notification inbox with per-item mark-as-read.
* An account deletion wizard with a grace period, and a guided danger zone in
  settings.
* A user/moderator/admin ladder with capabilities named by intent, and indexes
  on the seven foreign keys PostgreSQL does not index by default.

### Changed

* Settings was reorganised: the username field merged into Profile, the bio
  has a live preview and character cap, and Save no longer claims unsaved
  changes after an edit was undone.
* Download-first project detail pages and tighter explore cards; server
  pages rebuilt around the join panel.
* Images are resized in the browser before upload. The bundle budget, tracing
  tools and a shared scroll-reveal observer were updated.
* Action feedback moved to Sonner, leaving field validation inline.

### Fixed

* Settings tab resolution, username cooldown boundaries and the malformed
  timestamp path were covered and corrected.
* `isomorphic-dompurify` was kept out of the server bundle, and content that
  relies on the reveal observer no longer stays invisible.

## [ALPHA-0.12.1] - 2026-09-26

Changes on `main` since `ALPHA-0.10.2`.

### Added

* Account deletion for every sign-in method, generated usernames and a
  sign-in methods page.
* Favicons and a web manifest, plus placeholders on password fields and
  visible visited-link styling in the footer.

### Fixed

* The Dokploy compose stack deploys cleanly, runs migrations on deploy and
  repairs the migration journal; a fresh deployment works end to end.
* The exposed port changed from 6001 to 3000.
* Tailwind scans only `src/` for classes, so server-rendered pages link the
  real stylesheet.
* Failed chunk loads recover instead of leaving the page stuck.

## [ALPHA-0.10.2] - 2026-09-26

The first tagged alpha, built on the initial project types and the ElysiaJS
event server.

### Added

* Real mods and plugins with uploads and downloads.
* Blog post previews, Meilisearch search and admin auto-refresh.
* A rotating project-type headline and a pixel theme transition.
* One login field for both email address and username.

### Fixed

* Webhooks, API limits, auth sessions and deployment settings were hardened.
* The API is deployed, migrations run on deploy, and uploads and counters were
  hardened.
* `accounts.issuer` was dropped so sign-ups work on Better Auth 1.7.3+.
* Button-styled links render as real links, and the compose stack passes
  `VITE_API_URL` and `TRUST_PROXY` into the containers.

## Earlier alpha releases

Releases before `ALPHA-0.10.2` predate the `ALPHA-*` tag convention. They
include the initial project types, moderated publishing, the move to object
storage and the Node 24 toolchain. See the git history for those commits.
