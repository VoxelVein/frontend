# VoxelVein Frontend

**The modern, open-source marketplace for Minecraft creators.**

VoxelVein is a self-hostable marketplace where creators publish Minecraft
mods, modpacks, plugins, resource packs, shaders, datapacks and servers, and
players find and download them. This repository holds the web application and
the small ElysiaJS event server behind the wider
[VoxelVein](https://github.com/VoxelVein) platform.

> [!NOTE]
> The project is in alpha (`ALPHA-0.17.0`). No paid services are planned. The
> legal pages still contain placeholder operator details and need review by a
> qualified professional before production.

## Features

### Content and discovery

* Seven project types: mods, modpacks, plugins, resource packs, shaders,
  datapacks and servers. Browse, detail and gallery pages live under
  `/p/<type>/...`; the old top-level URLs redirect so bookmarks keep working.
* Typo-tolerant search powered by PostgreSQL full-text and trigram matching,
  with no separate search service. Filter by category, Minecraft version,
  loader or platform and client requirement; sort by downloads, activity or
  name.
* Trending projects, a news section built around cards, and an interactive
  platform comparison on the home page.
* Versioned releases with release channels, changelogs, game-version and
  loader metadata, plus one independently replaceable download per launcher
  for modpacks.
* Server listings with a join address, port, live player counts, and links to
  required or recommended content.
* Server voting with optional Votifier rewards (classic v1 and NuVotifier v2),
  a 24-hour rolling cooldown, and daily, weekly, monthly and all-time
  leaderboards. See [server voting](docs/content/server-voting.md).
* Creator disclosures: seven optional labels such as AI-generated content or
  discontinued, each with an explanation, shown in a Transparency section on
  public pages.
* S3-compatible storage for uploads and images, with per-file and site-wide
  quotas. Images are resized in the browser before upload (512 px for an icon,
  1920 px for a gallery image); GIFs are left alone to preserve animation.
* Project reporting with fixed reason codes and a moderator review inbox.
* Download counting with per-client deduplication.

### Creators and community

* A creator dashboard to create projects, upload versions with live progress,
  manage images and server details, and edit slugs and disclosures.
* Moderated publishing: `draft` to `pending` to `published`, with a review
  queue, rejection reasons and notifications to the creator.
* A blog with Markdown posts, categories, multiple co-authors, post search and
  editor shortcuts for staff.
* Public author profiles at `/u/<username>` with a Markdown bio.

### Accounts and administration

* Better Auth with email/password, Google, GitHub and passkeys, including
  passkey sign-in on the login page. Cloudflare Turnstile protects password
  sign-in and sign-up.
* Three roles on one ladder: `user`, `moderator` and `admin`. The same
  permissions are enforced server-side so a moderator cannot reach admin-only
  actions.
* Ownership transfers: owners offer a project to another member after
  re-authenticating, and the recipient must accept; admins can move projects
  immediately. Offers and outcomes appear in a transfers inbox and the
  notification bell.
* An admin panel with ten URL-driven sections: users, transfers, sessions,
  posts, storage, notifications, account deletions, reviews, reports and
  support tickets, each hidden from roles that cannot use it.
* Support tickets at `/support` (at most five open per member), a notification
  bell with per-item and bulk mark-as-read, legal pages and a cookie consent
  banner.
* Rate limiting through Valkey / Redis with an automatic in-memory fallback.

### Interface and engineering

* Server-rendered React 19 with progressive enhancement, light and dark
  themes with a view-transition switch, and a mobile-first responsive layout.
* WCAG 2.2 AA accessibility as a baseline, visible focus styles, reduced
  motion support, and an opt-in beta custom cursor.
* TypeScript in strict mode, TanStack Start and Router, TanStack Query and
  Form, Tailwind CSS v4 with OKLCH tokens, Drizzle ORM with PostgreSQL,
  Valibot validation shared across the stack, Vitest, Oxlint and Oxfmt.

## Requirements

* Node.js 24 or later (pinned in `mise.toml`, the Dockerfile and CI)
* pnpm 11.3.0, pinned through `packageManager` in `package.json`
* PostgreSQL for server-side data
* Optional: Redis or Valkey for shared rate limits, S3-compatible object
  storage for uploads, Google/GitHub OAuth credentials, Cloudflare Turnstile

## Getting started

```bash
git clone https://github.com/VoxelVein/frontend.git
cd frontend
pnpm install
cp .env.example .env.local
pnpm dev
```

The minimum configuration to boot the web app:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/voxelvein
BETTER_AUTH_SECRET=your-secret-here
BETTER_AUTH_URL=http://localhost:3000
VITE_SITE_URL=http://localhost:3000
API_URL=http://localhost:3002
VITE_API_URL=http://localhost:3002
NODE_ENV=development
```

`BETTER_AUTH_SECRET` needs at least 32 characters. The API server also needs
`WEBHOOK_SECRET` (32+ characters) and refuses to start without it. Storage,
OAuth providers and Turnstile each disable themselves when unset.

`pnpm dev` runs the web app on port 3000 and the API server on port 3002.
Use `pnpm dev:web` or `pnpm dev:api` to run only one. Apply migrations with
`pnpm db:migrate`; migrations `0029_project_disclosures` and
`0030_server_voting` must be applied before the features that use them.

> [!WARNING]
> Never commit `.env.local` or real credentials to the repository.

Voting needs `VOTING_ENCRYPTION_KEY` (a base64 encoded random 32-byte key) to
encrypt reward tokens, and production voting fails closed without Turnstile
configuration. See [server voting](docs/content/server-voting.md) for the
full deployment checklist.

## Repository layout

```text
src/
  components/   UI grouped by feature (admin, blog, dashboard, projects, ...)
  db/           Drizzle client, schema and generated migrations
  hooks/        Small client hooks
  lib/          Auth, roles, search, storage, voting, rate limiting
  routes/       TanStack Start file-based routes
  tasks/        Nitro scheduled tasks (hourly account purge)
  styles.css    Tailwind theme and design tokens
server/         Standalone ElysiaJS server: health, SSE events, webhooks
scripts/        Dev helpers, seed scripts, migration and docs checks
drizzle/        Generated SQL migrations
public/         Static assets and manifests
docs/           Guides for development, deployment and each feature area
```

See the [architecture overview](docs/architecture/overview.md) for how a
request flows through the stack.

## Common commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Run web app and API together |
| `pnpm dev:web` / `pnpm dev:api` | Run one side only |
| `pnpm build` / `pnpm start` | Build and run the Nitro production server |
| `pnpm test` / `pnpm test:coverage` | Vitest suite, with optional coverage |
| `pnpm typecheck` | TypeScript check |
| `pnpm check` / `pnpm fix` | Read-only quality check / auto-fix |
| `pnpm lint` / `pnpm format` | Oxlint / Oxfmt |
| `pnpm lint:md` | Markdown lint |
| `pnpm db:migrate` / `pnpm db:check` | Apply / check migrations |
| `pnpm docs:check` | Validate relative documentation links and anchors |
| `pnpm check:bundle` | Enforce the 780 kB raw / 250 kB gzipped budget |

A [`justfile`](justfile) wraps the same scripts as `just dev`, `just check`
and `just test`.

## Authentication and roles

| Role | Can do |
| --- | --- |
| `user` | Manage only their own content; no admin panel |
| `moderator` | Review projects, draft blog posts, disable an account |
| `admin` | Everything, including publishing posts, deleting users and roles |

Checks use named capabilities rather than repeated role comparisons, and the
same rules are mirrored in Better Auth's access-control statements. See
[accounts](docs/authentication/accounts.md),
[passkeys](docs/authentication/passkeys.md) and the
[admin panel](docs/content/admin-panel.md).

## API and live updates

The standalone ElysiaJS server exposes `GET /api/health`, an SSE stream at
`GET /api/events`, and an HMAC-verified webhook at `POST /api/webhooks/mods`.
Browse pages subscribe to the stream and offer a one-click refresh when
content changes. The server has no database connection; search lives in
Postgres. See the [API reference](docs/architecture/api.md).

## Deployment

The main workflow is `main` to `prod`, where a merge triggers the production
deployment. Supported targets:

* [Docker](docs/deployment/docker.md) and [Podman](docs/deployment/podman.md)
* [Dokploy](docs/deployment/dokploy.md) with Traefik and Compose
* [Vercel](docs/deployment/vercel.md), [Netlify](docs/deployment/netlify.md)
  and [Cloudflare Workers](docs/deployment/cloudflare-workers.md)

Production images include the web server, the API server and a one-shot
migration runner. Every pull request runs lint, typecheck, tests, build, bundle
budget, documentation links and migration drift checks through the shared
`.github/workflows/_quality.yml`.

## Documentation

The full guide index lives in [docs/README.md](docs/README.md). Useful
starting points:

* [Projects, versions, uploads and reviews](docs/content/projects.md)
* [Server voting](docs/content/server-voting.md)
* [Admin panel](docs/content/admin-panel.md)
* [Postgres search](docs/search/postgres.md)
* [Object storage](docs/storage/object-storage.md)
* [Security hardening](docs/security/hardening.md)
* [Roadmap](ROADMAP.md), [TODO](TODO.md) and [Changelog](CHANGELOG.md)

## Contributing

Contributions are welcome. Read [AGENTS.md](AGENTS.md) for engineering
conventions and [CONTRIBUTING.md](CONTRIBUTING.md) for the branch strategy
and pull request process. Security issues should follow
[SECURITY.md](SECURITY.md), and participation is governed by the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

VoxelVein Frontend is open source. See [LICENSE](LICENSE).
