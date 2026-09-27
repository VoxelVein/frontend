---
description: Validate the .opencode/ setup — check skills, commands, context files, and references for consistency
tags: [validation, structure, skills, commands]
---

# Validate OpenCode Setup

Comprehensive validation of the `.opencode/` directory for consistency, missing files, broken references, and stale paths.

## Usage

```
/validate-repo
```

## What It Checks

### 1. Skills

For each skill in `.opencode/skills/`:

- `SKILL.md` exists and has valid frontmatter (`name`, `description`)
- Referenced files (e.g. `references/`, `scripts/`) exist
- No stale or broken file paths in the SKILL.md
- Consistent frontmatter format (name, description, version, author, type, category, tags)

### 2. Commands

For each command in `.opencode/command/`:

- `.md` file exists and has valid frontmatter (`description`)
- Referenced skills exist in `.opencode/skills/`
- No stale shell commands (e.g. referencing `pnpm lint` when it should be `pnpm check`)
- No references to non-existent files (e.g. `registry.json`, `.agents/`)

### 3. Context Files

- `.opencode/context/` directory structure is intact
- No orphaned files (exist but not referenced)
- No broken cross-references between context files

### 4. Agents

- `.opencode/agents/` files exist and have valid frontmatter
- No references to removed directories (`.agents/`)
- Subagent references are valid

### 5. Root Configuration

- `AGENTS.md` exists and has no stale references
- `opencode.json` is valid JSON
- No references to `.agents/` directory (removed)

### 6. Stale Path Check

Grep the entire `.opencode/` and `AGENTS.md` for:

- `.agents/` references (directory was removed)
- `motion/react` references (package was removed)
- `registry.json` references (doesn't exist in this project)
- `pnpm lint` (should be `pnpm check` for lint validation)
- `pnpm type:check` (should be `pnpm typecheck`)

## Output

Report in sections:

```
## OpenCode Setup Validation

### Skills (N found)
✅ frontend-design — SKILL.md present, frontmatter valid
✅ apple-design — SKILL.md present, 122 reference files
✅ ...

### Commands (N found)
✅ test.md — references valid
⚠️ optimize.md — generic, no project-specific references
✅ ...

### Context
✅ N context files, no orphans, no broken refs

### Agents
✅ N agents, frontmatter valid

### Stale References
✅ No .agents/ references
✅ No motion/react references
✅ No registry.json references

### Summary
✅ Passed: N | ⚠️ Warnings: N | ❌ Errors: N
```
