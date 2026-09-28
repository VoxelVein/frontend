# VoxelVein Frontend — Roadmap

> [!NOTE]
> This roadmap reflects the current state of the repository. It is a living
> document — update it as work lands or plans change.

## Current Focus

* **Content images** — project icons and gallery images stored in object
  storage, with Unpic for delivery. Nothing in the UI is blocked on this;
  the current design uses letter avatars and has no image slots yet.
* **Legal review** — the six legal pages need a real operator name and
  address, a single consistent contact address, and review by a qualified
  professional.
* **Accessibility and quality sweep** — route-level tests for `/admin`,
  `/settings`, and `/dashboard`; skeletons and empty states on any
  remaining page.

## In Progress

* Legal pages (Impressum, Privacy, Cookies, ToS, ToU, Disclaimer,
  Legal Notes) — placeholder content pending review before production
* Content images and image optimization
* Broader RBAC beyond the current `user` / `admin` pair

## Planned

* Email verification for password accounts, so they can upload content.
  This is the single biggest functional gap: without it, only social
  sign-ins and admins can publish.
* Password reset
* Notification email (review decisions, deletion confirmations)
* Email change flow
* Creator dashboards and per-project analytics
* Sitemap and per-route Open Graph tags. `og:image` is deliberately
  absent today rather than pointing at a missing file.
* A status page and a public changelog page, both of which the footer
  already reserves a "Soon" slot for
* RBAC: roles beyond `user` and `admin`
* Loading skeletons and empty states across any remaining page

## Future Ideas

* Reporting and abuse reports on projects
* Modpack/plugin/sharder submission workflows beyond single uploads
* Collections and curated lists
* Version-level changelog diffing
* WebAuthn passkey sign-in on the login page (the endpoint exists and is
  unused)

## Completed

* All six project types end to end — mods, modpacks, plugins, resource
  packs, shaders, and servers — each with a browse page, a detail page,
  creator forms, filters, and search
* Server listings with join address, port, linked content, and a derived
  client requirement (`required` / `recommended` / `vanilla`) that the
  search query and the detail page both compute
* Moderated publishing: `draft` → `pending` → `published` with an admin
  review queue, rejection reasons, and creator notifications
* Content hosting: Postgres projects, versions, and files; uploads to
  S3-compatible storage (Garage locally, Cloudflare R2 in production);
  quota enforcement with advisory locks; download counting with
  per-client deduplication
* Search moved from Meilisearch to Postgres full-text and trigram
  matching, with an index-parity test that fails when the SQL and the
  index expressions drift
* Creator dashboard with URL-driven tabs, version picker, upload progress,
  and a danger zone
* Blog: Markdown posts, admin post management with live preview, and
  Postgres-backed post search
* Public author profiles at `/u/$username` with a Markdown bio, linked
  from every project byline
* Better Auth with email/password, Google, GitHub, passkeys, the admin
  plugin, and a generated-username `/welcome` flow
* Account lifecycle: 14-day deletion grace period, hourly purge task,
  username history and reservations, 14-day change cooldown, protected
  projects, and an admin restore path
* Admin panel with seven tabs: users, sessions, posts, storage,
  notifications, account deletions, and reviews
* ElysiaJS API server with signed webhooks and SSE live events, with
  connection caps
* ElysiaJS API server hardened: strict CSP, anti-replay on webhooks,
  `WEBHOOK_SECRET` validation at startup, and security headers on the
  web app
* Navbar and footer polish: active states, overflow menu, landmarks,
  touch targets, and "Soon" treatment for unbuilt destinations
* Accessibility: WCAG 2.2 AA baseline, skeleton and empty states, reduced
  motion throughout, and a view-transition theme toggle
* Sage Garden theme applied; gradients and shadows removed from components
* Docker multi-stage build and Compose dev/prod/host-port overrides
* CI: lint, typecheck, test, build, bundle budget check, and docs lint on
  every pull request
* Bundle budget enforcement at 700 kB raw / 250 kB gzipped
* `just` recipes and `mise` tool versions; Node.js 24 standardized across
  Docker, CI, and documentation
* Agent skills and MCP servers for the project's `.opencode/` folder
