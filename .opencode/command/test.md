---
description: Run the complete testing pipeline
---

# Testing Pipeline

This command runs the complete testing pipeline for the project.

## Usage

```
/test
```

## Instructions

1. **Type check**  -  Run `pnpm typecheck` and report any type errors.
2. **Lint + format**  -  Run `pnpm check` and report any lint/format issues. If issues exist, run `pnpm fix` and re-check.
3. **Tests**  -  Run `pnpm test` and report any test failures.
4. **Fix**  -  If any failures were found, fix them and re-run the relevant step.
5. **Report**  -  Summarize results: what passed, what failed, and what was fixed.

## What This Command Does

1. `pnpm typecheck`  -  TypeScript type checking (`tsc --noEmit`)
2. `pnpm check`  -  Oxlint + Oxfmt lint and format validation (Ultracite)
3. `pnpm test`  -  Vitest test suite
