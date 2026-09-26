# Contributing to VoxelVein Frontend

Thank you for your interest in contributing to VoxelVein Frontend! This
guide covers the contribution workflow, code-quality requirements, and the
pull request process.

## Table of Contents

* [Development Setup](#development-setup)
* [Branch Strategy](#branch-strategy)
* [Making Changes](#making-changes)
* [Code Quality](#code-quality)
* [Accessibility](#accessibility)
* [Documentation](#documentation)
* [Commit Conventions](#commit-conventions)
* [Pull Request Process](#pull-request-process)
* [Getting Help](#getting-help)

## Development Setup

1. Fork the repository and clone your fork:

   ```bash
   git clone https://github.com/<your-username>/frontend.git
   cd frontend
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create a `.env.local` file. See [README.md](README.md) for the required
   variables.

4. Start the development servers (web app + ElysiaJS API server):

   ```bash
   pnpm dev:all
   ```

The web app runs on `http://localhost:3000` and the API server on
`http://localhost:3002`. See [docs/development/setup.md](docs/development/setup.md)
for the full setup guide.

## Branch Strategy

The repository uses a simple promotion model:

```text
feature branch → main → prod → production deployment
```

* `main` is the primary development branch. All new work lands here via
  pull requests.
* `prod` is the production branch. It is protected: changes can only land
  through a pull request whose head branch is `main`. Merging `main` into
  `prod` triggers an automatic deployment.
* Never develop directly on `prod`.

## Making Changes

1. Create a branch from `main`:

   ```bash
   git checkout main
   git pull
   git checkout -b feat/your-change
   ```

2. Make your changes. Keep them focused and reviewable.
3. Run the quality checks described below.
4. Commit your changes. See [Commit Conventions](#commit-conventions).
5. Push your branch and open a pull request against `main`.

## Code Quality

Before opening a pull request, run:

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm lint:md
```

For automatic fixes:

```bash
pnpm fix
```

The project uses **Ultracite** (on Oxlint + Oxfmt) for code quality and
**markdownlint** for documentation. A Husky pre-commit hook runs
`ultracite fix` automatically.

## Accessibility

Accessibility is a first-class requirement (WCAG 2.2 AA). When you change
UI code:

* Use semantic HTML and landmarks (`header`, `nav`, `main`, `section`,
  `footer`, and so on).
* Ensure keyboard operability with visible focus indicators.
* Use ARIA sparingly and correctly — prefer native semantics.
* Keep text contrast at WCAG AA (4.5:1 normal text, 3:1 large text).
* Respect `prefers-reduced-motion`.
* Test with keyboard only and with a screen reader.

## Documentation

* Markdown files are validated with `markdownlint-cli2` using the GitHub
  ruleset (`pnpm lint:md`).
* Only two rules are disabled: `MD033` (inline HTML) and `MD041`
  (first-line heading). Do not disable additional rules to make
  documentation pass — fix the documentation instead.
* `.opencode/` and `.tmp/` are excluded from Markdown validation.
* Update documentation when your change affects behavior, configuration,
  or commands.

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <description>
```

Common types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`,
`ci`, `perf`.

Examples:

```text
feat(auth): add password reset flow
fix(nav): correct mobile menu focus trap
docs: update Docker port documentation
```

## Pull Request Process

### Pull request templates

There is one template per category of change, in
[`.github/PULL_REQUEST_TEMPLATE`](.github/PULL_REQUEST_TEMPLATE). Each one
asks the questions that actually matter for that area, and skips the ones
the required checks already answer.

Unlike issues, GitHub does not show a chooser for pull request templates, so
pick one with its link:

* **General change** — anything that does not fit below. This is the
  default, so a plain compare URL already loads it.
  [1-general.yml](https://github.com/VoxelVein/frontend/compare/main?quick_pull=1&template=1-general.yml)
* **Bug fix** — a defect with an identifiable root cause.
  [2-bug-fix.yml](https://github.com/VoxelVein/frontend/compare/main?quick_pull=1&template=2-bug-fix.yml)
* **New feature** — new user-facing capability.
  [3-feature.yml](https://github.com/VoxelVein/frontend/compare/main?quick_pull=1&template=3-feature.yml)
* **UI or accessibility** — a component, page, or anything affecting
  accessibility.
  [4-ui-accessibility.yml](https://github.com/VoxelVein/frontend/compare/main?quick_pull=1&template=4-ui-accessibility.yml)
* **Database, migration, or search** — schema, migration, query, or index.
  [5-database-search.yml](https://github.com/VoxelVein/frontend/compare/main?quick_pull=1&template=5-database-search.yml)
* **Dependency, build, or CI** — dependencies, Docker, or workflows.
  [6-dependencies-tooling.yml](https://github.com/VoxelVein/frontend/compare/main?quick_pull=1&template=6-dependencies-tooling.yml)
* **Documentation** — Markdown only, no code change.
  [7-docs.yml](https://github.com/VoxelVein/frontend/compare/main?quick_pull=1&template=7-docs.yml)

Templates are filled in by the person opening the pull request. Dependabot
and other bots do not fill them, so an automated pull request may arrive with
an empty template. That is expected; the reviewer reads the diff instead.

### Opening the pull request

1. Open a pull request against `main` using the matching template.
2. Merge `main` into your branch and get every required check green before
   asking for review. These run automatically on every pull request:

   * `Source branch policy`
   * `Quality checks`
   * `Markdown lint` and `Markdown accessibility`
   * `Docker build`

3. Request a review from a maintainer.
4. Address review feedback by pushing additional commits to your branch.
5. Once approved and merged, changes flow to `prod` via a separate pull
   request from `main`, which deploys automatically.

## Getting Help

* Open an issue for bugs or feature requests.
* Join the official Discord server for community discussion.
* Review [SECURITY.md](SECURITY.md) before reporting vulnerabilities.
