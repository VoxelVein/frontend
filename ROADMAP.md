# VoxelVein Frontend — Roadmap

> [!NOTE]
> This roadmap reflects the current state of the repository. It is a living
> document — update it as work lands or plans change.

## Current Focus

* **Settings & authentication overhaul** — fix Better Auth passkeys and
  session freshness at the source, restructure Settings around URL-driven
  tabs (`?tab=`), and migrate settings state to TanStack Query + TanStack
  Forms.
* **Developer experience** — unified dev commands (`pnpm dev` starts the
  complete environment), `just` recipes, `mise` tool versions, and Node.js
  24 standardization across Docker, CI, and documentation.

## In Progress

* Settings & auth overhaul (passkeys, sessions, profile, appearance,
  danger zone)
* Agent skills and MCP servers for the project's `.opencode/` folder
* Legal pages (Impressum, Privacy, Cookies, Terms, Terms of Use,
  Disclaimer) — placeholder content pending review before production

## Planned

* Content pages for resource packs, modpacks, shaders, and servers (nav
  and footer links exist; routes do not)
* Email verification for password accounts, so they can upload content
* Project icons and gallery images (stored in object storage)
* Download deduplication and rate limiting; periodic search reindex of
  download counts
* Moderation UI for admins (list and restore removed projects)
* Image optimization with Unpic once real content images exist (mod and
  project thumbnails) — the current UI uses letter avatars and tiny user
  avatars, so there is nothing to convert yet
* Loading skeletons and empty states across remaining pages

## Future Ideas

* Notifications
* Email change flow
* Creator dashboards and analytics
* Modpack/plugin/sharder submission workflows

## Completed

* Content hosting for mods and plugins: Postgres projects, versions, and
  files; uploads to S3-compatible storage (Garage locally, Cloudflare R2
  in production); download counting; creator dashboard; Meilisearch sync

* Marketplace shell: homepage, projects hub, mods search with Meilisearch
  and filters
* ElysiaJS API server with webhooks, SSE live events, and search proxy
* Better Auth with username/password, Google social sign-in, and passkeys
* Settings management UI (profile, account, passkeys, sessions)
* Navbar and footer polish (active states, landmarks, touch targets)
* Accessibility audit fixes (WCAG 2.2 AA baseline)
* Sage Garden theme applied; gradients/shadows removed from components
* Docker multi-stage build and Compose dev/prod overrides
* CI pipeline (lint, typecheck, test, build, bundle check, docs)
* esbuild dependency override to ^0.25.0 (Dependabot fix)
* Actionable error message when the search service is unreachable
* Agent skills: performance-guidelines, web-design-guidelines
