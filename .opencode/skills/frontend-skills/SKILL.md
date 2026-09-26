---
name: frontend-skills
description: Frontend development workflow skill covering React 19+, TanStack Router/Start, component architecture, state management, and testing patterns for this project. Use when asked about "frontend patterns", "React conventions", "component structure", "routing", "state management", or "frontend architecture".
version: 1.0.0
author: voxelvein
type: skill
category: development
tags:
  - frontend
  - react
  - tanstack
  - component-architecture
  - state-management
  - testing
  - routing
---

# Frontend Skills

**Purpose**: Consolidate frontend development workflow knowledge for this project — React patterns, TanStack conventions, component architecture, and testing strategies.

## Scope

This skill covers frontend-specific development patterns. It complements (not duplicates):

- **web-design-guidelines** — visual design, tokens, a11y review, UI consistency
- **performance-guidelines** — debounce/throttle, virtualization, image optimization

Use this skill when the task involves **building or modifying frontend code**, not reviewing visuals or performance.

---

## React 19+ Conventions

- **Ref as prop**: use `ref` as a regular prop instead of `React.forwardRef`
- **Function components only**: no class components
- **Hooks at top level**: never call hooks conditionally
- **Dependency arrays**: specify all dependencies correctly
- **Key prop**: prefer unique IDs over array indices for iterables
- **Children between tags**: nest children between opening/closing tags, not as props
- **No component definitions inside components**: extract to separate files

---

## TanStack Router / Start

- **File-based routing**: files under `src/routes/` define routes automatically
- **Route definitions**: use `createFileRoute` for route components
- **Data fetching**: use Server Functions where appropriate
- **Head management**: use `HeadContent`/`Scripts` in the root layout
- **Search params**: validate with Valibot schemas via `validateSearch`
- **Preloading**: use `preload="intent"` on `<Link>` for hover prefetch

---

## Component Architecture

### File Organization

```
src/components/
├── ui/              # shadcn/Base UI primitives (Button, Dialog, etc.)
├── navbar/          # Navigation components
├── settings/        # Settings page components
├── mods/            # Feature-specific components
└── motion/          # Animation components
```

### Patterns

- **Single responsibility**: one component per file, one concern per component
- **Composition over prop drilling**: use children and render props
- **Compound components**: for complex UI (e.g., DialogHeader/DialogContent/DialogFooter)
- **Custom hooks**: extract reusable logic into `src/hooks/` or colocated hooks
- **Named exports**: use `export { ComponentName }` — not default exports

### shadcn/Base UI Primitives

- Always use existing primitives from `src/components/ui/`
- Never hand-roll a replacement when a shadcn component exists
- Extend or compose — never fork
- Never introduce another component library

---

## State Management

- **Local state**: `useState` for component-scoped state
- **Server state**: `@tanstack/react-query` for API data
- **Form state**: `@tanstack/react-form` with Valibot validation
- **URL state**: TanStack Router search params for shareable state
- **Global state**: avoid — pass via props or context when truly needed

### Valibot for Validation

- Use named imports: `import { string, pipe, minLength } from "valibot"`
- Never wildcard imports: `import * as v from "valibot"`
- Schemas for form validation, search params, and API payloads
- Use `parse()` or `safeParse()` at boundaries

---

## Testing Patterns

- **Library**: `@testing-library/react` + Vitest
- **Query by role**: `getByRole`, `getByLabelText`, `getByText` — never by CSS class
- **Assertions in `it()`/`test()` blocks**: no `done` callbacks — use async/await
- **No `.only` or `.skip`** in committed code
- **Flat suites**: avoid excessive `describe` nesting
- **Mock external dependencies**: auth client, API calls, router
- **Test both paths**: success and failure cases

---

## File Naming Conventions

- **Components**: `kebab-case.tsx` (e.g., `mod-card.tsx`)
- **Hooks**: `use-*.ts` or colocated with component
- **Utilities**: `kebab-case.ts` in `src/lib/`
- **Routes**: TanStack file-based naming under `src/routes/`
- **Tests**: colocated `__tests__/` directories or `*.test.ts` suffix

---

## Import Conventions

- **Path aliases**: use `@/` prefix for absolute imports
- **Group order**: React → third-party → internal (`@/`) → relative
- **No barrel files**: import specific modules, not index re-exports
- **Named imports**: prefer named over default imports

---

## Common Workflows

### Adding a New Page

1. Create route file in `src/routes/`
2. Use `createFileRoute` with typed search params if needed
3. Add `pendingComponent` for loading skeleton
4. Add link in navbar if it's a top-level page
5. Run `pnpm typecheck` to regenerate route tree

### Adding a New Component

1. Check `src/components/ui/` for existing primitives
2. Create in the appropriate feature directory
3. Use shadcn primitives — compose, don't hand-roll
4. Add `aria-*` attributes for accessibility
5. Test with `getByRole` queries

### Adding a New API Integration

1. Define Valibot schema for request/response
2. Use `authClient` for auth-related calls
3. Wrap in `@tanstack/react-query` for caching
4. Handle loading, error, and empty states
5. Use `useMutation` for write operations
