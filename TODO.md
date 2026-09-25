# TODO

Current work items for the VoxelVein frontend. See [ROADMAP.md](ROADMAP.md)
for the longer-term plan.

## In Progress

* [ ] Legal pages (Impressum, Privacy, Cookies, ToS, ToU, Disclaimer) —
      placeholder content pending review
* [ ] Footer legal links (add Impressum, Cookies, ToU, Disclaimer)
* [ ] Update README (scope, commands, Node 24, mise, just, Unpic, legal)
* [ ] Repo-wide consistency audit (Node 22 → 24: setup.md, CI action)
* [ ] `/mods` loading skeletons (pendingComponent + initial-null handling)
* [x] Create `/mods/$slug` mod detail page (content hosting)
* [ ] Update web-design-guidelines SKILL.md (skeletons + empty states)
* [ ] Use `cn` more across the application
* [ ] Verification: typecheck, check, test, build, lint:md

## Completed

* [x] Write TODO.md
* [x] Navbar polish (active states, user menu, mobile)
* [x] Dev commands: `pnpm dev` / `dev:all` / `dev:web`
* [x] Create ROADMAP.md
* [x] Audit + improve Dockerfiles (Node 24)
* [x] Create justfile
* [x] Create mise.toml (Node 24)
* [x] Unpic integration (install + skill update; no current images to convert)
* [x] Update performance-guidelines SKILL.md (Unpic)

## Paused (settings & auth overhaul)

* [ ] DB migration: `lastUsedAt` on passkeys
* [ ] `auth.ts`: `freshAge: 0` + `afterVerification` hook
* [ ] QueryClient wiring in `router.tsx`
* [ ] Settings route restructure (`?tab=` with 5 tabs)
* [ ] `auth.functions.ts` server functions
* [ ] Settings components (Profile, Passkeys, Sessions, Appearance, Danger Zone)
* [ ] Tests
* [ ] Install skills/MCP into project `.opencode/`
