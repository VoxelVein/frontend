# Architecture Overview

VoxelVein is a full-stack TypeScript application built with TanStack
Start, React 19, Better Auth, and Drizzle ORM, with a standalone
ElysiaJS API server for real-time events. Search is part of the
database, not a separate service.

## Stack

| Layer        | Technology                                         |
| ------------ | -------------------------------------------------- |
| Framework    | TanStack Start (file-based routing)                |
| UI           | React 19, Tailwind CSS v4, Base UI                 |
| Server state | TanStack Query, TanStack Form                      |
| Animation    | CSS transitions and view transitions               |
| Auth         | Better Auth (credentials, social, admin, passkeys) |
| Database     | PostgreSQL, Drizzle ORM                            |
| Search       | PostgreSQL (`pg_trgm` + full-text)                 |
| API          | ElysiaJS (webhooks, SSE)                           |
| Runtime      | Nitro (production server, tasks)                   |
| Storage      | S3-compatible object storage                       |
| Rate limits  | Valkey (Linux Foundation fork of Redis)            |
| Validation   | Valibot                                            |
| Lint         | Ultracite (Oxlint + Oxfmt)                         |
| Tests        | Vitest, Testing Library                            |

## Directory layout

```text
src/
  components/       Reusable UI components, grouped by feature
    admin/          Admin panel tabs (users, sessions, posts, storage, …)
    blog/           Post card and shared search bar
    dashboard/      Creator project, version, and server forms
    legal/          Shared legal-document renderer
    motion/         Theme toggle, rotating text, view transitions
    navbar/         Navbar, mobile drawer, user menu
    projects/       Project browser, card, detail page
    settings/       Settings tabs
    ui/             Base UI + shadcn primitives
  db/               Drizzle client and schema
  hooks/            Reduced motion, username availability, post search
  lib/              Auth, projects, search, storage, server functions
    classes.ts      Class strings shared across unrelated components
  routes/           TanStack Start file-based routes
    api/            HTTP handlers: auth, upload, download
  tasks/            Nitro scheduled tasks
  test/             Vitest setup
  router.tsx        Router, QueryClient, SSR query integration
  start.ts          Security headers and CSRF middleware
  styles.css        Tailwind theme and global styles
server/
  index.ts          ElysiaJS entry point (Node adapter)
  lib/              Event registry and async queue
  routes/           health, SSE events, webhooks
drizzle/            Generated SQL migrations
scripts/            Seeding, Garage init, bundle check, version sync
docs/               Guides (this documentation)
```

## Pages and routes

Public pages:

| Route                              | What it does                  |
| ---------------------------------- | ----------------------------- |
| `/`                                | Hero, trending, explore, news |
| `/mods` and its five sibling types | Browse and search             |
| `/<type>/$slug`                    | Project detail page           |
| `/blog`, `/blog/$slug`             | Blog index and post           |
| `/u/$username`                     | Author profile with a bio     |
| `/login`, `/signup`, `/welcome`    | Auth, username picker         |
| `/legal` and its five siblings     | Legal pages                   |

Signed-in pages, with the tab in the URL:

| Route                 | What it does      |
| --------------------- | ----------------- |
| `/settings?tab=`      | Account settings  |
| `/dashboard/projects` | Creator dashboard |
| `/admin?tab=`         | Admin panel       |

Every route whose loader hits the database has a skeleton
`pendingComponent`: the home page, all six browse pages, all six detail
pages, the blog, a single post, an author profile, and both dashboard
project routes. The legal and auth routes load synchronously and need
none. `/settings` and `/admin` render their panels immediately and
skeleton inside each tab instead, so the tab list and its labels are never
replaced. Long lists (admin users and sessions) are virtualized.

## Request flow

1. A route file under `src/routes/` defines the page component and any
   `beforeLoad` guards. The router is configured in `src/router.tsx`;
   `src/start.ts` adds security headers and restricts CSRF protection to
   server functions.
2. Server functions (`src/lib/*.functions.ts`) run on the server and are
   called from loaders, route components, and TanStack Query hooks.
3. Better Auth handles sessions, social login, passkeys, and the admin
   API. The server config is in `src/lib/auth.ts`; the client is in
   `src/lib/auth-client.ts`; the HTTP surface is mounted at
   `/api/auth/*` by `src/routes/api/auth/$.tsx`. Authorization is the
   `user` / `moderator` / `admin` ladder in `src/lib/roles.ts` (pure, with
   no server imports, so client components can use it), with session
   guards in `src/lib/role-guards.ts` and the plugin's own statements in
   `src/lib/permissions.ts`. See
   [Admin Panel](../content/admin-panel.md#roles).
4. Drizzle reads and writes PostgreSQL through the pool in
   `src/db/index.ts`.
5. Search queries PostgreSQL directly from a server function. Every
   browse page calls `searchProjects`, which matches with a `tsvector`
   and trigram similarity in one query. See [Search](../search/postgres.md).
6. Project files are uploaded to and downloaded from S3-compatible
   object storage through the web app's API routes
   (`src/routes/api/`). See [Projects and Files](../content/projects.md).
7. Real-time mod events flow from webhook publishers to the API server
   (`POST /api/webhooks/mods`), which broadcasts them over SSE
   (`GET /api/events`) to the browser, where each browse page shows a
   live banner.

## Publishing and moderation

A project is created as a `draft`. It becomes `pending` when its owner
submits it for review — with a version and file, or join details for a
server — and `published` only when an admin approves it. Every public
read path filters on `status = 'published'`, so a project under review
disappears from search, downloads, trending, and profiles without any of
those queries changing. See [Projects and Files](../content/projects.md).

## Authentication

* Email/password sign-up and sign-in, gated by Cloudflare Turnstile.
* Google and GitHub social login, each enabled only when configured.
* Passkeys via the Better Auth passkey plugin.
* Sessions with sliding expiration (30-day lifetime, refreshed daily).
* Usernames with a 14-day change cooldown and a 14-day reservation for a
  previous name.

See the [authentication guides](../README.md#authentication).

## Background work

* `projectSearchCache` (LRU + TTL) backs browse-page results.
* Trending projects are recomputed at most once a minute.
* The `accounts:purge` Nitro task runs hourly and permanently deletes
  accounts past their 14-day deletion grace period.

## Theming

The design system uses OKLCH semantic tokens defined in
`src/styles.css`. Themes are applied from tweakcn.com with the shadcn
CLI, and `@lonik/themer` switches between light and dark with a view
transition. See [Custom Theme](../theming/custom-theme.md).

## Accessibility

Accessibility is a first-class requirement. Every component must meet
WCAG 2.2 AA. See [Accessibility Standards](../accessibility/standards.md).

## Related

* [Setup](../development/setup.md)
* [Commands](../development/commands.md)
* [Migrations](../database/migrations.md)
* [Projects and Files](../content/projects.md)
* [Search](../search/postgres.md)
* [API Server](api.md)
