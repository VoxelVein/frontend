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

#### Product

* Minecraft content marketplace experience
* Content discovery and browsing
* Creator-focused interfaces
* Responsive web interface
* Dark-mode-first design
* Accessible component foundation
* Server-rendered application

#### Engineering

* React 19
* TypeScript
* TanStack Start (full-stack React framework with SSR)
* TanStack Router (file-based, type-safe routing)
* Tailwind CSS v4
* Base UI + shadcn-style components (UI foundation)
* Better Auth (authentication)
* Drizzle ORM (database access and schema management)
* PostgreSQL (relational database)
* ElysiaJS (standalone API server with webhooks and SSE)
* Meilisearch (content search)
* Vitest (testing)
* Oxlint (linting)
* Oxfmt (formatting)
* Ultracite (unified code-quality checks and fixes)
* PNPM (package management)

---

## Tech Stack

| Technology          | Purpose                               |
| ------------------- | ------------------------------------- |
| **React 19**        | User interface                        |
| **TypeScript**      | Static typing                         |
| **TanStack Start**  | Full-stack React framework and SSR    |
| **TanStack Router** | Type-safe, file-based routing         |
| **Tailwind CSS v4** | Styling                               |
| **Base UI**         | Accessible UI primitives              |
| **Better Auth**     | Authentication                        |
| **Drizzle ORM**     | Database access and schema management |
| **PostgreSQL**      | Relational database                   |
| **ElysiaJS**        | Standalone API server (webhooks, SSE) |
| **Meilisearch**     | Content search engine                 |
| **Vite**            | Development and build tooling         |
| **Nitro**           | Production server runtime             |
| **Unpic**           | Image optimization (CDN-backed images)|
| **Vitest**          | Testing                               |
| **Oxlint**          | Linting                               |
| **Oxfmt**           | Formatting                            |
| **Ultracite**       | Unified code-quality checks and fixes |
| **PNPM**            | Package management                    |

---

## Requirements

Before starting development, ensure you have:

* **Node.js 24+**
* **PNPM 11.3.0** (managed via `packageManager` in `package.json`)
* **PostgreSQL** for local server-side database integration
* Git

> **Note:** The repository pins PNPM through the `packageManager` field, so
> using the pinned version is recommended. Node.js 24 is also pinned in
> [`mise.toml`](mise.toml) and used by the Dockerfile and CI.

---

## Getting Started

### Clone the Repository

```bash
git clone https://github.com/VoxelVein/frontend.git
cd frontend
```

### Install Dependencies

```bash
pnpm install
```

### Configure the Environment

Create a `.env.local` file in the root directory with the following
variables:

```env
BETTER_AUTH_SECRET=your-secret-here  # Must be at least 32 characters
BETTER_AUTH_URL=http://localhost:6001
DATABASE_URL=postgresql://user:password@localhost:5432/voxelvein
MEILI_HOST=http://localhost:7700
MEILI_MASTER_KEY=your-master-key      # Only needed when seeding
MEILI_SEARCH_KEY=your-search-key
API_URL=http://localhost:3002
API_PORT=3002
WEBHOOK_SECRET=your-webhook-secret    # Required, at least 32 characters
VITE_API_URL=http://localhost:3002
NODE_ENV=development
```

> Never commit `.env.local` or real credentials to the repository.

### Start the Development Server

The app and the ElysiaJS API server run side by side. Start the complete
development environment with:

```bash
pnpm dev
```

Or run them in separate terminals:

```bash
pnpm dev:web    # web app on http://localhost:6001
pnpm dev:api    # API server on http://localhost:3002
```

The development server runs on `http://localhost:6001` and the API server
on `http://localhost:3002`.

> `pnpm dev` delegates to `pnpm dev:all`, so the two commands can never
> drift apart. `pnpm dev:web` starts only the Vite app.

---

## Available Commands

| Command             | Description                                       |
| ------------------- | ------------------------------------------------- |
| `pnpm dev`          | Starts the complete dev environment (app + API)   |
| `pnpm dev:web`      | Starts only the Vite app (port 6001)              |
| `pnpm dev:api`      | Starts the ElysiaJS API server (watch)            |
| `pnpm dev:all`      | Runs the app and API server together              |
| `pnpm start:api`    | Starts the API server (no watch)                  |
| `pnpm send:webhook` | Sends a test mod webhook to the API               |
| `pnpm build`        | Builds the production bundle                      |
| `pnpm preview`      | Previews the production build                     |
| `pnpm start`        | Starts the built Nitro server                     |
| `pnpm test`         | Runs the Vitest test suite                        |
| `pnpm test:coverage`| Runs the Vitest suite with coverage               |
| `pnpm typecheck`    | Runs the TypeScript type checker                  |
| `pnpm lint`         | Runs the Oxlint linter                            |
| `pnpm lint:md`      | Runs markdownlint on Markdown files               |
| `pnpm format`       | Runs the Oxfmt formatter                          |
| `pnpm check`        | Runs the Ultracite checker                        |
| `pnpm fix`          | Applies Ultracite checks                          |
| `pnpm prepare`      | Initializes Husky Git hooks                       |

---

## Tooling

### mise

[`mise.toml`](mise.toml) pins the Node.js version (24). If you use mise:

```bash
mise install
```

### just

A [`justfile`](justfile) wraps the common package scripts so you can run
`just dev`, `just check`, `just test`, and so on instead of `pnpm <script>`.
Run `just` with no arguments to list all recipes.

---

## Architecture

The application follows this structure:

```text
src/
├── components/   # UI components (Base UI + shadcn-style)
├── routes/       # TanStack Start file-based routes
├── lib/          # Shared utilities and configuration
├── db/           # Drizzle ORM schema and client
└── styles/       # Global styles and design tokens

server/
├── index.ts      # ElysiaJS entry point (Node adapter)
├── lib/          # Event registry, Meilisearch client
└── routes/       # health, mods search, SSE events, webhooks
```

The Vite configuration integrates TanStack Start, TanStack Router, Tailwind
CSS, TanStack DevTools, Nitro, and React. The ElysiaJS API server runs as a
standalone service on its own port and is the single entry point for mod
search and real-time mod events. See
[docs/architecture/api.md](docs/architecture/api.md) for details.

---

## Database

The application uses **PostgreSQL** via **Drizzle ORM**.

* A local PostgreSQL instance is required for server-side database
  functionality.
* The connection is configured via `DATABASE_URL`:

  ```env
  DATABASE_URL=postgresql://user:password@localhost:5432/voxelvein
  ```

* Database migrations are stored in the `drizzle/` directory.

---

## Authentication

The application uses **Better Auth** for authentication.

* Required configuration:

  ```env
  BETTER_AUTH_SECRET=your-secret-here
  BETTER_AUTH_URL=http://localhost:6001
  ```

* For local development, `BETTER_AUTH_URL` should be set to the local
  application URL.

---

## API Server and Real-Time Updates

A standalone **ElysiaJS** API server (`server/`) powers mod search and
real-time mod events:

* `GET /api/health` — liveness check
* `GET /api/mods/search` — Meilisearch proxy used by the mods page
* `GET /api/events` — Server-Sent Events (SSE) stream of mod events
* `POST /api/webhooks/mods` — webhook endpoint (HMAC-SHA256 verified) that
  broadcasts `mod.created`, `mod.updated`, and `mod.deleted` events

The mods page subscribes to the SSE stream and shows a live banner when a
mod changes, with a one-click refresh that bypasses the search cache. Send
a test event with:

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

See [docs/architecture/api.md](docs/architecture/api.md) for the full API
reference.

---

## Legal Pages

The following legal pages exist as **placeholders** and must be reviewed by
a qualified professional before production:

* `/impressum` — Impressum (German legal notice)
* `/privacy` — Privacy Policy
* `/cookies` — Cookie Policy
* `/terms` — Terms of Service
* `/terms-of-use` — Terms of Use
* `/disclaimer` — Disclaimer

The cookie consent banner is implemented in
[`src/components/cookie-banner.tsx`](src/components/cookie-banner.tsx).

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the current focus, planned work, and
completed milestones. Day-to-day work items are tracked in
[TODO.md](TODO.md).

---

## Development Workflow

The workflow follows a simple promotion pattern:

```text
feature branch → main → prod → production deployment
```

### `main`

* The primary development branch.
* New work is developed on a dedicated branch and merged into `main` via
  pull requests.

### `prod`

* Represents the production branch.
* Merging `main` into `prod` triggers automatic production deployment.
* The `prod` branch is protected: changes can only land through a pull
  request whose head branch is `main`.

> [!IMPORTANT] Do not develop directly on `prod`. Changes must flow through
> `main` first.

---

## Code Quality

Before opening a pull request, run the following commands:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm lint:md
```

For automatic fixes:

```bash
pnpm fix
```

For formatting:

```bash
pnpm format
```

The project uses **Ultracite**, **Oxlint**, and **Oxfmt** for code-quality
enforcement, and **markdownlint** (via `markdownlint-cli2` with the GitHub
ruleset) for documentation.

---

## Testing

Tests use **Vitest** with Testing Library. Run the test suite with:

```bash
pnpm test
```

The repository is configured to succeed when no tests are present, allowing
the test command to remain part of the workflow.

---

## Production Build

Build the production application with:

```bash
pnpm build
```

Preview the generated build with:

```bash
pnpm preview
```

Start the production server:

```bash
pnpm start
```

The application uses **Nitro** for its production server output.

---

## Docker

### Development

Run the development environment with Docker:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up
```

The development Compose configuration mounts the source tree and runs the
complete development environment (Vite app + ElysiaJS API server) with hot
reload. The container listens on port `6001` and is exposed on host port
`1112`:

```text
host :1112 → container :6001 (Vite dev server)
```

### Production

Run the production environment with Docker:

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d
```

The production Compose configuration builds and runs the production image
with the Nitro server. The container listens on port `3000` and is exposed
on host port `1112`:

```text
host :1112 → container :3000 (Nitro server)
```

> The host port defaults to `1112` to avoid conflicts with other services
> (for example, Dokploy commonly occupies host port `3000`). Override it
> with the `PORT` environment variable if needed.

---

## Deployment

Production deployment follows this workflow:

```text
main → prod → automatic production deployment
```

Changes merged from `main` into `prod` are automatically deployed to
production.

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for the
full contribution guide, including branch strategy, code-quality
requirements, and the pull request process.

---

## Security

Found a security issue? See [SECURITY.md](SECURITY.md) for our vulnerability
reporting policy.

---

## Code of Conduct

Please review [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before participating
in the community.
