# VoxelVein Documentation

Guides for developing, configuring, and deploying the VoxelVein
frontend. Each guide lives in its own directory under `docs/`.

## Authentication

* [Email and Password](authentication/email-password.md) — configure
  email/password sign-up and sign-in
* [Passkeys](authentication/passkeys.md) — add passwordless passkey
  authentication
* [Sessions](authentication/sessions.md) — session lifetime, sliding
  expiration, and sign-out
* [Cloudflare Turnstile](authentication/turnstile.md) — bot protection
  for password sign-in and sign-up

## Social Providers

* [Google](social-providers/google.md) — set up Google Sign-In
* [GitHub](social-providers/github.md) — set up GitHub Sign-In

## Database

* [Migrations](database/migrations.md) — generate and apply Drizzle
  migrations

## Development

* [Setup](development/setup.md) — install dependencies and run the dev
  server
* [Commands](development/commands.md) — reference for the pnpm scripts

## Deployment

* [Docker](deployment/docker.md) — build and run the production image

## Content

* [Projects and Files](content/projects.md) — mods and plugins, versions,
  uploads, downloads, and permissions
* [Object Storage](storage/object-storage.md) — Garage for development,
  Cloudflare R2 for production

## Search

* [Meilisearch](search/meilisearch.md) — index, reindex, and query
  project search

## API

* [API Server](architecture/api.md) — ElysiaJS endpoints, webhooks, and
  real-time SSE events

## Theming

* [Custom Theme](theming/custom-theme.md) — apply a theme from
  tweakcn.com

## Accessibility

* [Standards](accessibility/standards.md) — WCAG 2.2 AA requirements for
  components and pages

## Architecture

* [Overview](architecture/overview.md) — how the pieces fit together
