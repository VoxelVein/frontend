---
name: context7
description: Fetch current, version-specific documentation for the libraries this project actually uses (TanStack Start/Router/Query, Elysia, Drizzle ORM, Better Auth, Meilisearch, Vite, Tailwind, shadcn) via the Context7 MCP server. Use before writing or reviewing any code against a third-party API, when an error message names a library, when upgrading a dependency, or whenever you are unsure whether a remembered API still exists. Triggers on "latest docs for", "how do I use", "does this API still", "correct way to", or any unfamiliar import from node_modules.
version: 2.0.0
author: voxelvein
type: skill
category: tooling
tags:
  - documentation
  - context7
  - mcp
  - dependencies
---

# Context7 — Live Library Documentation

## Why this exists

Every other rule in this repo assumes you have **current** library
knowledge. That assumption is false by default: training data goes stale,
and this stack moves fast (Vite 8, Tailwind 4, React 19, Ultracite 5,
shadcn on Base UI). A remembered API that was correct two majors ago will
typecheck-fail or, worse, silently misbehave.

**Look it up. Don't guess.** If you are writing code that calls a
third-party API you have not read in this session, resolve it first.

## Step 1 — Resolve the library ID

Context7 addresses docs by ID, not by name. Always resolve first:

```json
{ "libraryName": "TanStack Router", "query": "file-based routing createFileRoute" }
```

## Step 2 — Query the docs

Scope **one question per call.** The index degrades badly when you bundle
several topics — you get a shallow answer for each instead of one good
answer.

```json
{
  "libraryId": "/tanstack/router",
  "query": "createFileRoute loader and beforeLoad difference"
}
```

## Project libraries

Resolve these by name; the IDs are stable, but resolve anyway to pick
up the right version.

| Concern | Library |
| --- | --- |
| Routing, SSR, server functions | TanStack Start, TanStack Router |
| Server data fetching/caching | TanStack Query |
| HTTP API routes | Elysia |
| Schema and migrations | Drizzle ORM, drizzle-kit |
| Auth, passkeys, OAuth | Better Auth |
| Search | Meilisearch (`meilisearch` JS client) |
| Build/dev server | Vite 8 |
| Styling | Tailwind CSS 4 |
| Components | shadcn/ui (built on Base UI) |
| Validation | Valibot |
| Object storage | AWS SDK v3 (S3-compatible: Garage) |
| Linting/formatting | Ultracite, Oxlint, Oxfmt |
| Tests | Vitest, Testing Library |
| Agent tooling | OpenCode plugins, skills, commands |

Not on this stack — do not reach for these: Next.js, Sentry, Vercel,
Supabase, Firebase, Redux, Jest.

## When to use it

Reach for Context7 **before** writing code that:

- Calls a library function whose signature you're recalling rather than
  reading
- Uses a config key, plugin hook, or CLI flag
- Upgrades a dependency, or resolves an error whose message names a
  package
- Mirrors a config file you can't see the source of (`drizzle.config.ts`,
  `oxlint.config.ts`, `components.json`)

Skip it for: this repo's own code (read the source), anything in
`AGENTS.md` (it's authoritative here), and well-established APIs you've
already read in this session.

## API keys

`mcp.context7.com/mcp` works without a key at a lower rate limit. For a
free key, set `CONTEXT7_API_KEY` and add the header to the server entry
in `opencode.json` and `.mcp.json`.

## Fallback — HTTP API

If the MCP server is unavailable, the same data is reachable directly.
This path needs `curl` and `jq`:

```bash
# Resolve an ID
curl -s "https://context7.com/api/v2/libs/search?libraryName=drizzle-orm&query=migrations" \
  | jq -r '.results[0].id'

# Fetch docs as plain text
curl -s "https://context7.com/api/v2/context?libraryId=/drizzle-orm/drizzle-orm&query=generate+migrations&type=txt"
```

Prefer the MCP tools: they return structured data, cost fewer tokens,
and need no local dependencies.
