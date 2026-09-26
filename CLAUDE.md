@AGENTS.md

# Claude Code

## Read this first

Everything above this line is imported from `AGENTS.md` — Ultracite and
Oxlint rules, the WCAG 2.2 AA requirements, the code standards, the
UI/UX rules, and the tooling table.

**Do not copy that file's content into this one.** `AGENTS.md` is the
single source of truth. Claude Code stops reading `AGENTS.md` on its own
as soon as a `CLAUDE.md` exists, so this file must keep the import or
every project rule silently disappears.

If you change a rule, change it in `AGENTS.md` and let the import carry
it here.

## Where the tooling lives

OpenCode and Claude Code read different directories. Nothing below is
duplicated — this table says where to look and edit.

| Thing | OpenCode | Claude Code | Canonical location |
| --- | --- | --- | --- |
| Instructions | `AGENTS.md` | `CLAUDE.md` (imports it) | `AGENTS.md` |
| MCP servers | `opencode.json` | `.mcp.json` | both, kept in sync |
| Skills | `.opencode/skills/` | `.claude/skills/` | `.opencode/skills/` |
| Commands | `.opencode/command/` | `.claude/commands/` | `.opencode/command/` |
| Agents | `.opencode/agent/` | `.claude/agents/` | `.opencode/agent/` |
| Plugins | `.opencode/plugins/` | hooks in `.claude/` | `.opencode/plugins/` |
| Context | `.opencode/context/` | — | `.opencode/context/` |

### MCP servers

`.mcp.json` provides `context7` only. Use it to look up library docs
instead of recalling them:

```json
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp"
    }
  }
}
```

Claude Code prompts you to approve a project-scoped server the first time
it runs. It has no per-server "off" switch in `.mcp.json`, which is why
only the read-only `context7` server is committed there. `shadcn` and the
opt-in `meilisearch` server are OpenCode-side; see the MCP table in
`AGENTS.md` for the opt-in snippet and the scoped-key requirement.

### Skills

The skills in `.opencode/skills/` are the maintained set. Claude Code does
not read that directory. To use them here, either:

* Run `/import` once to copy them into `.claude/skills/` — simplest, but
  the copies drift, so re-run it after changing a skill; or
* Symlink it with
  `mkdir -p .claude && ln -s ../.opencode/skills .claude/skills` —
  always current, but breaks on Windows checkouts without
  `core.symlinks`, where it silently becomes a text file.

Prefer `/import`, or check the symlink resolved correctly if you use one.
The same applies to commands and agents.

## Claude Code specifics

* Prefer plan mode for anything touching `src/db/schema.ts`, the auth
  configuration, or `drizzle.config.ts` — those deploy on merge to
  `main` and are not reviewed after the fact.
* The repo has a Husky pre-commit hook that runs `ultracite fix` on the
  working tree and re-stages. Expect files to be reformatted
  automatically at commit time; that is not a bug to chase.
* Required checks before requesting review: `pnpm check`,
  `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm check:bundle
  --no-build`, and `pnpm lint:md`. The `5-database-search.yml` PR
  template assumes you already reindexed Meilisearch if you touched
  `posts` or `projects`.
* `docs/` and `CONTRIBUTING.md` describe the same workflows. When a
  procedure changes, update both or neither — a doc that contradicts
  `AGENTS.md` is worse than no doc.
