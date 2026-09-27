<!-- Context: openagents-repo/lookup | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Lookup: File Locations

**Purpose**: Quick reference for finding files

---

## Directory Tree

```
opencode-agents/
├── .opencode/
│   ├── agent/
│   │   ├── core/                    # Core system agents
│   │   ├── development/             # Dev specialists
│   │   ├── content/                 # Content creators
│   │   ├── data/                    # Data analysts
│   │   ├── product/                 # Product managers (ready)
│   │   ├── learning/                # Educators (ready)
│   │   └── subagents/               # Delegated specialists
│   │       ├── code/                # Code-related
│   │       ├── core/                # Core workflows
│   │       ├── system-builder/      # System generation
│   │       └── utils/               # Utilities
│   ├── command/                     # Slash commands
│   ├── context/                     # Shared knowledge
│   │   ├── core/                    # Core standards & workflows
│   │   ├── development/             # Dev context
│   │   ├── content-creation/        # Content creation context
│   │   ├── data/                    # Data context
│   │   ├── product/                 # Product context
│   │   ├── learning/                # Learning context
│   │   └── openagents-repo/         # Repo-specific context
│   ├── prompts/                     # Model-specific variants
│   ├── tool/                        # Custom tools
│   └── plugin/                      # Plugins
├── evals/
│   ├── framework/                   # Eval framework (TypeScript)
│   │   ├── src/                     # Source code
│   │   ├── scripts/                 # Test utilities
│   │   └── docs/                    # Framework docs
│   └── agents/                      # Agent test suites
│       ├── core/                    # Core agent tests
│       ├── development/             # Dev agent tests
│       └── content/                 # Content agent tests
├── scripts/
│   ├── registry/                    # Registry management
│   ├── validation/                  # Validation tools
│   ├── testing/                     # Test utilities
│   ├── versioning/                  # Version management
│   ├── docs/                        # Doc tools
│   └── maintenance/                 # Maintenance
├── docs/                            # Documentation
│   ├── agents/                      # Agent docs
│   ├── contributing/                # Contribution guides
│   ├── features/                    # Feature docs
│   └── getting-started/             # User guides
├── registry.json                    # Component catalog
├── install.sh                       # Installer
├── VERSION                          # Current version
└── package.json                     # Node dependencies
```

---

## Where Is...?

| Component              | Location                                |
| ---------------------- | --------------------------------------- |
| **Core agents**        | `.opencode/agents/core/`                 |
| **Category agents**    | `.opencode/agents/{category}/`           |
| **Subagents**          | `.opencode/agents/subagents/`            |
| **Commands**           | `.opencode/command/`                    |
| **Context files**      | `.opencode/context/`                    |
| **Prompt variants**    | `.opencode/prompts/{category}/{agent}/` |
| **Tools**              | `.opencode/tool/`                       |
| **Plugins**            | `.opencode/plugin/`                     |
| **Agent tests**        | `evals/agents/{category}/{agent}/`      |
| **Eval framework**     | `evals/framework/src/`                  |
| **Registry scripts**   | `scripts/registry/`                     |
| **Validation scripts** | `scripts/validation/`                   |
| **Documentation**      | `docs/`                                 |
| **Registry**           | `registry.json`                         |
| **Installer**          | `install.sh`                            |
| **Version**            | `VERSION`                               |

---

## Where Do I Add...?

| What | Where |
| --- | --- |
| **New core agent** | `.opencode/agents/core/{name}.md` |
| **New category agent** | `.opencode/agents/{category}/{name}.md` |
| **New subagent** | `.opencode/agents/subagents/{category}/{name}.md` |
| **New command** | `.opencode/command/{name}.md` |
| **New context** | `.opencode/context/{category}/{name}.md` |
| **Agent tests** | `evals/agents/{category}/{agent}/tests/` |
| **Test config** | `evals/agents/{category}/{agent}/config/config.yaml` |
| **Documentation** | `docs/{section}/{topic}.md` |
| **Script** | `scripts/{purpose}/{name}.sh` |

---

## Specific File Paths

### Core Files

```
registry.json                        # Component catalog
install.sh                           # Main installer
update.sh                            # Update script
VERSION                              # Current version (0.5.0)
package.json                         # Node dependencies
CHANGELOG.md                         # Release notes
README.md                            # Main documentation
```

### Core Agents

```
.opencode/agents/core/openagent.md
.opencode/agents/core/opencoder.md
.opencode/agents/meta/system-builder.md
```

### Development Agents

```
.opencode/agents/subagents/development/frontend-specialist.md
.opencode/agents/subagents/development/devops-specialist.md
```

### Content Agents

```
.opencode/agents/content/copywriter.md
.opencode/agents/content/technical-writer.md
```

### Key Subagents

```
.opencode/agents/subagents/code/test-engineer.md
.opencode/agents/subagents/code/reviewer.md
.opencode/agents/subagents/code/coder-agent.md
.opencode/agents/subagents/core/task-manager.md
.opencode/agents/subagents/core/documentation.md
```

### Core Context

```
.opencode/context/core/standards/code-quality.md
.opencode/context/core/standards/documentation.md
.opencode/context/core/standards/test-coverage.md
.opencode/context/core/standards/security-patterns.md
.opencode/context/core/workflows/task-delegation-basics.md
.opencode/context/core/workflows/code-review.md
```

### Registry Scripts

```
scripts/registry/validate-registry.sh
scripts/registry/auto-detect-components.sh
scripts/registry/register-component.sh
scripts/registry/validate-component.sh
```

### Validation Scripts

```
scripts/validation/validate-context-refs.sh
scripts/validation/validate-test-suites.sh
scripts/validation/setup-pre-commit-hook.sh
```

### Eval Framework

```
evals/framework/src/sdk/              # Test runner
evals/framework/src/evaluators/       # Rule evaluators
evals/framework/src/collector/        # Session collection
evals/framework/src/types/            # TypeScript types
```

---

## Path Patterns

### Agents

```
.opencode/agents/{category}/{agent-name}.md
```

**Examples**:

- `.opencode/agents/subagents/development/frontend-specialist.md`
- `.opencode/agents/subagents/code/test-engineer.md`

### Context

```
.opencode/context/{category}/{topic}.md
```

**Examples**:

- `.opencode/context/core/standards/code-quality.md`
- `.opencode/context/ui/web/react-patterns.md`
- `.opencode/context/content-creation/principles/copywriting-frameworks.md`

### Tests

```
evals/agents/{category}/{agent-name}/
├── config/config.yaml
└── tests/{test-name}.yaml
```

**Examples**:

- `evals/agents/core/openagent/tests/smoke-test.yaml`
- `evals/agents/development/frontend-specialist/tests/approval-gate.yaml`

### Scripts

```
scripts/{purpose}/{action}-{target}.sh
```

**Examples**:

- `scripts/registry/validate-registry.sh`
- `scripts/validation/validate-test-suites.sh`
- `scripts/versioning/bump-version.sh`

---

## Naming Conventions

### Files

- **Agents**: `{name}.md` or `{domain}-specialist.md`
- **Context**: `{topic}.md`
- **Tests**: `{test-name}.yaml`
- **Scripts**: `{action}-{target}.sh`
- **Docs**: `{topic}.md`

### Directories

- **Categories**: lowercase, singular (e.g., `development`, `content`)
- **Purposes**: lowercase, descriptive (e.g., `registry`, `validation`)

---

## Quick Lookups

### Find Agent File

```bash
# By name
find .opencode/agents -name "{agent-name}.md"

# By category
ls .opencode/agents/{category}/

# All agents
find .opencode/agents -name "*.md" -not -path "*/subagents/*"
```

### Find Test File

```bash
# By agent
ls evals/agents/{category}/{agent}/tests/

# All tests
find evals/agents -name "*.yaml"
```

### Find Context File

```bash
# By category
ls .opencode/context/{category}/

# All context
find .opencode/context -name "*.md"
```

### Find Script

```bash
# By purpose
ls scripts/{purpose}/

# All scripts
find scripts -name "*.sh"
```

---

## Related Files

- **Quick start**: `quick-start.md`
- **Categories**: `core-concepts/categories.md`
- **Commands**: `lookup/commands.md`

---

**Last Updated**: 2025-12-10  
**Version**: 0.5.0
