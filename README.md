<p align="center">
  <img
    alt="VoxelVein Frontend"
    src="https://shieldcn.dev/header/surface.svg?title=VoxelVein+Frontend"
  />
</p>

<p align="center">
  <strong>The modern, open-source marketplace for Minecraft creators.</strong>
  <br />
  Discover, share, and manage community-created Minecraft content.
</p>

<p align="center">
  <a href="https://github.com/VoxelVein/frontend">
    <img
      alt="License"
      src="https://shieldcn.dev/github/VoxelVein/frontend/license.svg"
    />
  </a>
</p>

# VoxelVein Frontend

## Overview

**VoxelVein Frontend** is the web application for
[VoxelVein](https://github.com/VoxelVein), an open-source marketplace for
Minecraft creators.

This repository contains the **frontend and server-side application layer**,
built with TanStack Start, TanStack Router, and Nitro. It is part of the
VoxelVein platform but does not include the full infrastructure stack.

### Features

#### Content

* Six project types: **mods**, **modpacks**, **plugins**, **resource
  packs**, **shaders**, and **servers**, each with a browse page and a
  detail page
* Typo-tolerant full-text search straight from PostgreSQL, with no
  separate search service
* Filter by category, Minecraft version, loader or platform, and client
  requirement; sort by downloads, activity, or name
* Trending projects and a news section on the home page
* S3-compatible object storage for uploads, with per-file and site-wide
  quota enforcement
* Project icons and gallery images in the same bucket, with a web console
  for local development
* Versioned releases with release channels, changelogs, and game-version
  and loader metadata
* Server listings with join address, port, client requirement, and links
  to required or recommended mods
* Download counting with per-client deduplication

#### Creators and community

* Creator dashboard: create projects, upload versions, manage images and
  server details
* Moderated publishing: a project goes `draft` to `pending` to `published`
  through a review queue
* Blog with Markdown posts, admin post management, and post search
* Public author profiles at `/u/<username>` with a Markdown bio
* Public profiles for every project type, with a version picker and
  download links

#### Accounts and administration

* Better Auth with email/password, Google, GitHub, and passkeys
* Three roles on one ladder: `user`, `moderator`, and `admin`
* A moderator reviews projects and drafts blog posts, and can disable an
  account. Publishing a post, deleting a user, changing roles, and storage
  settings stay admin-only
* Cloudflare Turnstile on password sign-in and sign-up
* Settings for profile, username, bio, sign-in methods, passkeys,
  sessions, and a guided account-deletion flow
* Admin panel: users, sessions, posts, storage, notifications, pending
  account deletions, and the publishing review queue, with each tab
  hidden from roles that cannot use it
* Notification bell with per-item and bulk mark-as-read
* Public legal pages and a cookie consent banner

#### Interface

* Server-rendered with progressive enhancement
* Light and dark themes with a view-transition theme switch
* Responsive, mobile-first layout
* WCAG 2.2 AA accessibility as a baseline requirement
* Scroll reveals that respect `prefers-reduced-motion`
* Visible required-field markers on forms, marked in the label but kept out
  of the accessible name

#### Engineering

* React 19 and TypeScript
* TanStack Start (full-stack React framework with SSR)
* TanStack Router (file-based, type-safe routing)
* TanStack Query and TanStack Form (server state and forms)
* Tailwind CSS v4 with OKLCH design tokens
* Base UI and shadcn-style components
* Better Auth (authentication, passkeys, admin plugin)
* Drizzle ORM and PostgreSQL
* ElysiaJS (standalone API server with signed webhooks and SSE)
* Valibot (validation shared by client and server)
* Nitro (production server runtime and scheduled tasks)
* Vitest and Testing Library
* Ultracite on Oxlint and Oxfmt
* markdownlint (documentation)
* pnpm (package management)

---

## Tech Stack

| Technology          | Purpose                                    |
| ------------------- | ------------------------------------------ |
| **React 19**        | User interface                             |
| **TypeScript**      | Static typing                              |
| **TanStack Start**  | Full-stack React framework and SSR         |
| **TanStack Router** | Type-safe, file-based routing              |
| **TanStack Query**  | Server state, caching, background refresh  |
| **TanStack Form**   | Form state and validation                  |
| **Tailwind CSS v4** | Styling                                    |
| **Base UI**         | Accessible UI primitives                   |
| **Better Auth**     | Authentication, passkeys, admin plugin     |
| **Drizzle ORM**     | Database access and schema management      |
| **PostgreSQL**      | Relational database and search             |
| **ElysiaJS**        | Standalone API server (webhooks, SSE)      |
| **Valibot**         | Validation schemas shared across the stack |
| **Vite**            | Development and build tooling              |
| **Nitro**           | Production server runtime and tasks        |
| **Vitest**          | Testing                                    |
| **Oxlint**          | Linting                                    |
| **Oxfmt**           | Formatting                                 |
| **Ultracite**       | Unified code-quality checks and fixes      |
| **markdownlint**    | Documentation linting                      |
| **pnpm**            | Package management                         |

---

## Requirements

Before starting development, ensure you have:

* **Node.js 24 or later**
* **pnpm 11.3.0**, pinned through the `packageManager` field in
  `package.json`
* **PostgreSQL** for local server-side database integration
* Git

Node 24 is also pinned in [`mise.toml`](mise.toml), the Dockerfile, and CI.

---

## Getting Started

### Clone the repository

```bash
git clone https://github.com/VoxelVein/frontend.git
cd frontend
```

### Install dependencies

```bash
pnpm install
```

### Configure the environment

Copy the example file and fill in the values. `.env.example` documents
every supported variable:

```bash
cp .env.example .env.local
```

The minimum needed to boot the web app:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/voxelvein
BETTER_AUTH_SECRET=your-secret-here  # at least 32 characters
BETTER_AUTH_URL=http://localhost:3000
VITE_SITE_URL=http://localhost:3000
API_URL=http://localhost:3002
VITE_API_URL=http://localhost:3002
NODE_ENV=development
```

The API server additionally requires `WEBHOOK_SECRET` (at least 32
characters) and refuses to start without it. Object storage, Google,
GitHub, and Cloudflare Turnstile are all optional, and each one simply
disables its own feature when unset.

> Never commit `.env.local` or real credentials to the repository.

### Start the development server

```bash
pnpm dev
```

Or run them in separate terminals:

```bash
pnpm dev:web    # web app on http://localhost:3000
pnpm dev:api    # API server on http://localhost:3002
```

`pnpm dev` delegates to `pnpm dev:all`, so the two cannot drift apart.
`pnpm dev:web` starts only the Vite app.

---

## Available Commands

### Development

| Command             | Description                                   |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Starts the whole dev environment (app + API)  |
| `pnpm dev:web`      | Starts only the Vite app (port 3000)          |
| `pnpm dev:api`      | Starts the ElysiaJS API server (watch)        |
| `pnpm dev:all`      | Runs the app and API server together          |
| `pnpm start:api`    | Starts the API server (no watch)              |
| `pnpm send:webhook` | Sends a test mod webhook to the API           |
| `pnpm build`        | Builds the production bundle                  |
| `pnpm preview`      | Previews the production build                 |
| `pnpm start`        | Starts the built Nitro server from `.output/` |
| `pnpm check:bundle` | Checks the main chunk against the size budget |

### Quality

| Command              | Description                         |
| -------------------- | ----------------------------------- |
| `pnpm typecheck`     | Runs the TypeScript type checker    |
| `pnpm test`          | Runs the Vitest test suite          |
| `pnpm test:coverage` | Runs the Vitest suite with coverage |
| `pnpm check`         | Lint and format check (read-only)   |
| `pnpm fix`           | Lint and format auto-fix            |
| `pnpm lint`          | Runs the Oxlint linter only         |
| `pnpm format`        | Formats source files with Oxfmt     |
| `pnpm lint:md`       | Runs markdownlint on Markdown files |
| `pnpm lint:md:fix`   | Auto-fixes Markdown issues          |
| `pnpm prepare`       | Initializes Husky Git hooks         |

### Database, content, and infrastructure

| Command                 | Description                              |
| ----------------------- | ---------------------------------------- |
| `pnpm db:migrate`       | Applies pending Drizzle migrations       |
| `pnpm db:studio`        | Opens Drizzle Studio                     |
| `pnpm db:check`         | Check for an ungenerated migration       |
| `pnpm db:seed`          | Seeds demo projects and blog posts       |
| `pnpm db:seed:projects` | Seeds demo projects of every type        |
| `pnpm db:seed:posts`    | Seeds demo blog posts                    |
| `pnpm db:seed:admin`    | Promotes a user to a staff role          |
| `pnpm mc:versions`      | Refreshes the Minecraft version manifest |
| `pnpm storage:init`     | Prepares the local Garage bucket         |
| `pnpm docs:check`       | Checks Markdown links and anchors        |

To generate a migration, use the project-local Drizzle binary:
`./node_modules/.bin/drizzle-kit generate`. There is deliberately no
`db:generate` script, and `pnpm dlx drizzle-kit` fails in a fresh
environment without `drizzle-orm`.

---

## Tooling

### mise

[`mise.toml`](mise.toml) pins the Node.js version. If you use mise:

```bash
mise install
```

### just

A [`justfile`](justfile) wraps the common package scripts, so you can run
`just dev`, `just check`, or `just test` instead of the equivalent `pnpm`
command. Run `just` with no arguments to list every recipe.

---

## Architecture

The repository contains two servers and one shared library tree:

```text
src/
├── components/     # UI components, grouped by feature
│   ├── admin/      # Admin panel tabs
│   ├── blog/       # Blog cards and search
│   ├── dashboard/  # Creator project, version, server, and image forms
│   ├── legal/      # Shared legal-document renderer
│   ├── motion/     # Theme toggle, rotating text, view transitions
│   ├── navbar/     # Navbar, mobile drawer, user menu, notifications
│   ├── projects/   # Project browser, card, detail, image, gallery
│   ├── settings/   # Settings tabs
│   └── ui/         # Base UI and shadcn primitives
├── db/             # Drizzle client and schema
├── hooks/          # Reduced motion, username availability, post search
├── lib/            # Auth, roles, projects, search, storage, server functions
├── routes/         # TanStack Start file-based routes
├── tasks/          # Nitro scheduled tasks
├── test/           # Vitest setup
├── router.tsx      # Router, QueryClient, SSR query integration
├── start.ts        # Security headers and CSRF middleware
└── styles.css      # Tailwind theme and design tokens

server/             # Standalone ElysiaJS API server
├── index.ts        # Entry point (Node adapter, CORS)
├── lib/            # Event registry and async queue
└── routes/         # health, SSE events, webhooks
```

The Vite configuration integrates TanStack Start, TanStack Router,
TanStack DevTools, Tailwind CSS, Nitro, and React. Nitro also runs the
hourly account-purge scheduled task.

`src/lib/roles.ts` holds the role ladder and is deliberately free of
server imports, so client components can check a role without pulling the
database into the browser bundle. Session-based guards live in
`src/lib/role-guards.ts`.

See [docs/architecture/overview.md](docs/architecture/overview.md) for how
a request flows through the stack.

---

## Database

The application uses **PostgreSQL** through **Drizzle ORM**.

* A local PostgreSQL instance is required for server-side database
  functionality.
* The connection is configured through `DATABASE_URL`:

  ```env
  DATABASE_URL=postgresql://user:password@localhost:5432/voxelvein
  ```

* Migrations live in `drizzle/`. Apply them with `pnpm db:migrate`.
* Search is part of the database rather than a separate service: `pg_trgm`
  and full-text indexes created by the migrations back every query. See
  [docs/search/postgres.md](docs/search/postgres.md).

To bring up Postgres and local object storage together:

```bash
just infra           # docker-compose.yml: Postgres and Garage
just storage-init    # create the bucket and access key
```

For an object storage server with a browser console, see
[docs/storage/rustfs.md](docs/storage/rustfs.md).

---

## Authentication and Roles

The application uses **Better Auth**.

* Required configuration:

  ```env
  BETTER_AUTH_SECRET=your-secret-here   # at least 32 characters
  BETTER_AUTH_URL=http://localhost:3000
  ```

* Sign-in methods: email/password, Google, GitHub, and passkeys. Google
  and GitHub each need their own `*_CLIENT_ID` and `*_CLIENT_SECRET`;
  without them the provider and its button are simply absent.
* Password sign-in and sign-up are gated by Cloudflare Turnstile. Without
  `VITE_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET` the widget does not
  render, and those two endpoints fail closed with `503`.
* Usernames are separate from the display name, with a 14-day change
  cooldown and a reservation window for a previous name.

Authorization is a single ladder in `ROLE_RANK` (`src/lib/roles.ts`):

| Role        | Can                                                           |
| ----------- | ------------------------------------------------------------- |
| `user`      | Only their own projects. Nothing in the admin panel.          |
| `moderator` | Review projects, draft blog posts, disable an account.        |
| `admin`     | Everything, plus publishing posts, deleting users, and roles. |

Every check calls `hasRole(role, minimum)` rather than comparing role
names, so adding a role extends the ladder without touching call sites. The
same split is expressed a second time in Better Auth's access-control
statements (`src/lib/permissions.ts`), which is what actually gates the
`/admin/*` endpoints, so a moderator cannot delete a user even if an app
guard were missed.

See [docs/content/admin-panel.md](docs/content/admin-panel.md#roles) for
the full matrix.

---

## API Server and Real-Time Updates

A standalone **ElysiaJS** API server (`server/`) handles real-time events:

* `GET /api/health`, a liveness check
* `GET /api/events`, a Server-Sent Events stream of mod events
* `POST /api/webhooks/mods`, an HMAC-SHA256-verified webhook that
  broadcasts `mod.created`, `mod.updated`, and `mod.deleted`

Every project browse page subscribes to the SSE stream and shows a live
banner when something changes, with a one-click refresh that bypasses the
search cache. Send a test event with:

```bash
pnpm send:webhook mod.created "My Mod"
```

Required configuration:

```env
API_URL=http://localhost:3002
API_PORT=3002
WEBHOOK_SECRET=your-webhook-secret
VITE_API_URL=http://localhost:3002
```

The server has no database connection: it publishes and streams events
only. Search lives in Postgres. See
[docs/architecture/api.md](docs/architecture/api.md) for the full
reference and [docs/content/projects.md](docs/content/projects.md) for
the web app's own upload and download endpoints.

---

## Object Storage

Uploaded files and project images live in S3-compatible object storage.
Local development uses [Garage](https://garagehq.deuxfleurs.fr/) or
[RustFS](docs/storage/rustfs.md), and production uses Cloudflare R2.

The app only uses the S3 API, so switching providers means changing
environment variables only. Images are proxied through the app rather than
redirected, because the published-state check has to run on every request.

> Images are resized in the browser before upload (512px for an icon,
> 1920px for a gallery image), so the full-size original never reaches the
> bucket. GIFs are exempt, because resizing one would drop its animation.

See [docs/storage/object-storage.md](docs/storage/object-storage.md) for the
object layout, [rustfs](docs/storage/rustfs.md) for the local console
setup, and [cloudflare-r2](docs/storage/cloudflare-r2.md) for production.

---

## Legal Pages

These pages exist as **placeholders** and must be reviewed by a qualified
professional before production. `/legal` still carries `Unknown` for the
operator's name and address:

* `/legal` legal notes (§ 5 DDG service-provider notice)
* `/privacy` privacy policy
* `/cookies` cookie policy
* `/terms` terms of service — the single binding legal document
* `/disclaimer` trademark and content-provenance notes, cross-referencing the
  terms rather than restating them

`/terms-of-use` redirects to `/terms`. It used to be a second, shorter set of
terms with overlapping warranty and account rules, which left no single document
a reader could point to as the operative one. The route is kept so existing
links and bookmarks still resolve.

All six share the renderer in
[`src/components/legal/legal-page.tsx`](src/components/legal/legal-page.tsx)
and name `admin@vomlabs.com` as the contact address. The cookie consent
banner is implemented in
[`src/components/cookie-banner.tsx`](src/components/cookie-banner.tsx).

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the current focus, planned work, and
completed milestones. Day-to-day work items are tracked in
[TODO.md](TODO.md).

---

## Development Workflow

```text
feature branch -> main -> prod -> production deployment
```

### `main`

* The primary development branch.
* New work is developed on a dedicated branch and merged into `main`
  through pull requests.

### `prod`

* Represents the production branch.
* Merging `main` into `prod` triggers the production deployment.
* The branch is protected: changes can only land through a pull request
  whose head branch is `main`.

> [!IMPORTANT]
> Do not develop directly on `prod`. Changes must flow through `main`
> first.

---

## Continuous Integration

The gate lives in one place, the reusable workflow
`.github/workflows/_quality.yml`, called by `main.yml`, `pr.yml`, and
`deploy.yml`. Run the same checks locally before opening a pull request:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm check:bundle --no-build
pnpm lint:md
pnpm db:check
pnpm docs:check
```

Two of these catch things nothing else does:

* `pnpm db:check` fails when the schema has a change with no generated
  migration. Migrations apply automatically at merge time, so that
  combination would ship code reading columns the database does not have.
* `pnpm docs:check` resolves every relative link and heading anchor.
  markdownlint has no rule for link targets, so a renamed section
  otherwise leaves links quietly pointing at nothing.

`pnpm fix` applies automatic lint and format fixes, and `pnpm format`
formats source files only.

The project enforces code quality with **Ultracite**, **Oxlint**, and
**Oxfmt**, and documentation with **markdownlint** (via `markdownlint-cli2`
with the GitHub ruleset). A Husky pre-commit hook runs `ultracite fix` and
re-stages your files, so formatting is applied at commit time.

Markdown-only changes skip the heavy jobs, and the deployed images are
published with provenance and SBOM attestations.

---

## Testing

Tests use **Vitest** with Testing Library and jsdom:

```bash
pnpm test
```

Coverage is scoped to a hand-picked list of files with thresholds (80%
lines, statements, and functions; 70% branches):

```bash
pnpm test:coverage
```

Tests live next to what they cover in `__tests__` folders: route tests in
`src/__tests__`, component tests in `src/components/__tests__`, and
library tests in `src/lib/__tests__`.

---

## Production Build

```bash
pnpm build     # build the production bundle
pnpm preview   # preview the generated build
pnpm start     # start the production server
```

The application uses **Nitro** for its production server output. The
production image also ships the standalone API server and a one-shot
migration runner as separate build targets. See
[docs/deployment/docker.md](docs/deployment/docker.md).

---

## Docker

### Development with Docker

```bash
docker compose -f compose.yaml -f compose.dev.yaml up
```

The development configuration mounts the source tree and runs the whole
development environment, the Vite app and the ElysiaJS API server in the
same container, with hot reload. Vite is pinned to container port `6001`
and the API to `3002`:

```text
host :1112 -> container :6001 (Vite dev server)
host :3002 -> container :3002 (API server)
```

`migrate` and the standalone `api` service sit behind a Compose profile in
this file, so migrations stay a manual `pnpm db:migrate`.

### Production with Docker

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d --build
```

`db` starts first, the one-shot `migrate` service applies pending
migrations and exits, and `web` starts only after it succeeds, so a deploy
never serves new code against an old schema. `api` starts independently.

This stack publishes **no host ports**: under Dokploy, Traefik routes
straight to the container network. To reach it from the host, add the
opt-in port file:

```bash
docker compose -f compose.yaml -f compose.prod.yaml \
  -f compose.host-ports.yaml up -d
```

```text
host :1112 -> container :3000 (Nitro server)
host :1113 -> container :3002 (API server)
```

> Host ports default to `1112` and `1113` to avoid clashing with other
> services on a shared host. Override them with `WEB_PORT` and
> `API_HOST_PORT`.

For a self-contained local stack that also includes Garage for object
storage, use `docker-compose.yml` instead.

---

## Deployment

```text
main -> prod -> automatic production deployment
```

Changes merged from `main` into `prod` are deployed automatically. The
`deploy` workflow builds the web, API, and migration images, pushes them to
`ghcr.io` tagged with the `package.json` version and the commit SHA, and
fails unless the `VITE_API_URL` and `VITE_SITE_URL` repository variables
are set. See [docs/deployment/dokploy.md](docs/deployment/dokploy.md) for
the Dokploy setup.

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the
branch strategy, code-quality requirements, and the pull request process.

---

## Security

Found a security issue? See [SECURITY.md](SECURITY.md) for the
vulnerability reporting policy.

---

## Code of Conduct

Please review [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before
participating in the community.
