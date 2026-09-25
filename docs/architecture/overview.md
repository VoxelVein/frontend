# Architecture Overview

VoxelVein is a full-stack TypeScript application built with TanStack
Start, React 19, Better Auth, and Drizzle ORM, with a standalone
ElysiaJS API server for search and real-time events.

## Stack

| Layer      | Technology                              |
| ---------- | --------------------------------------- |
| Framework  | TanStack Start (file-based routing)     |
| UI         | React 19, Tailwind CSS v4, Base UI      |
| Animation  | CSS transitions (`EASE_OUT_CSS`)        |
| Auth       | Better Auth                             |
| Database   | PostgreSQL, Drizzle ORM                 |
| Search     | Meilisearch                             |
| API        | ElysiaJS (webhooks, SSE)                |
| Validation | Valibot                                 |
| Lint       | Ultracite (Oxlint + Oxfmt)              |

## Directory layout

```text
src/
  components/       Reusable UI components
    settings/       Settings page sections
    ui/             Base UI primitives (button, tabs, ...)
  db/               Drizzle client and schema
  lib/              Auth, validation, animation easing
  routes/           TanStack Start file-based routes
  styles.css        Tailwind theme and global styles
server/
  index.ts          ElysiaJS entry point (Node adapter)
  lib/              Event registry, Meilisearch client
  routes/           health, mods search, SSE events, webhooks
drizzle/            Generated SQL migrations
docs/               Guides (this documentation)
```

## Request flow

1. A route file under `src/routes/` defines the page component and any
   `beforeLoad` guards.
2. Server functions (for example `src/lib/auth.functions.ts`) run on
   the server and are called from client components.
3. Better Auth handles sessions, social login, and passkeys. The
   server config is in `src/lib/auth.ts`; the client is in
   `src/lib/auth-client.ts`.
4. Drizzle reads and writes PostgreSQL through the pool in
   `src/db/index.ts`.
5. Project search runs through the ElysiaJS API server: the mods and
   plugins pages call `searchProjects`, which proxies to
   `GET /api/projects/search` on the API server, which queries
   Meilisearch.
6. Project files are uploaded to and downloaded from S3-compatible
   object storage through the web app's API routes. See
   [Projects and Files](../content/projects.md).
7. Real-time mod events flow from webhook publishers to the API server
   (`POST /api/webhooks/mods`), which broadcasts them over SSE
   (`GET /api/events`) to the browser.

See [API Server](api.md) for the full API reference.

## Authentication

* Email/password sign-up and sign-in.
* Google (and optionally GitHub) social login.
* Passkeys via the Better Auth passkey plugin.
* Sessions with sliding expiration (30-day lifetime).

See the [authentication guides](../README.md#authentication).

## Theming

The design system uses OKLCH semantic tokens defined in
`src/styles.css`. Themes are applied from tweakcn.com with the shadcn
CLI. See [Custom Theme](../theming/custom-theme.md).

## Accessibility

Accessibility is a first-class requirement. Every component must meet
WCAG 2.2 AA. See [Accessibility Standards](../accessibility/standards.md).

## Related

* [Setup](../development/setup.md)
* [Commands](../development/commands.md)
* [Migrations](../database/migrations.md)
* [API Server](api.md)
