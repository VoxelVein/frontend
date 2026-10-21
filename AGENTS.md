# VoxelVein engineering guide

You're working on the frontend application of VoxelVein. VoxelVein is a self-hostable and open-source marketplace for creators to upload and showcase their Minecraft mods/modpacks/plugins/shaders/resourcepacks/servers/datapacks to. Keep changes maintainable, tested, and consistent with the surrounding code.

## Getting started

- Use pnpm and run commands from the workspace root.
- Read the package README and nearby tests before changing a package.
- Keep commits focused, but clean up small issues encountered in files you already touch.
- Prefer established libraries over custom implementations when maintained package exists.
- New dependencies are acceptable when they reduce implementation complexity.

## Repository layout

- `src/` contains the React client, made using TanStack Start.
- `server/` contains a temporary ElysiaJS client, that should later be replaced by a custom Rust daemon.
- `scripts/` contains temporary and permanent scripts, written in TypeScript, JavaScript or Bash.
- `public/` contains assets and manifests.
- `drizzle/` contains migrations done automatically by Drizzle ORM.
- `docs/` contains a documentation about the structure of this project. If you did not work yet, and are analyzing the project, do not only read project files, but also the markdown files in this directory, when you notice inconsistencies, you can ask the user, if you should fix it, and then automatically commit it.
- `.opencode/` contains an AI agent framework for plan-first development, made for agentic engineering using OpenCode.
- `.github/` contains GitHub Actions, Issue- and Pull Request templates, and Dependabot configurations.

## TypeScript conventions

- Keep TypeScript strict and resolve type errors instead of weakening compiler options.
- Avoid `any`. Treat data from requests, responses, and other external boundaries as `unknown` until it has been validated or narrowed.
- Prefer inference for local implementation details and explicit types at exported package boundaries.
- Derive request and response types from shared Valibot schemas when possible so runtime validation and static types stay aligned.
- Use `import type` for type-only imports.
- Prefer discriminated unions when modeling a fixed set of states of outcomes.
- Avoid type assertions and non-null assertions unless the invariant is guaranteed and clear from nearby code.
- Keep types close to their implementation when they are private to one module.
- Mark values `readonly` when callers should not mutate them, and avoid mutating objects received from another layer.
- Choose descriptive domain names instead of generic names such as `Data`, `Item`, or `Result`.
- Always set up types, for Components.

## React conventions

- Use function components and keep each component focused on one clear responsibility.
- Keep state as close as possible to where it is used. Lift state only when multiple components need to coordinate through it.
- Use TanStack Query for server state, including queries, mutatins, cache updates, and invalidations.
- Do not copy query data into local state. Reserve local state for temporary interface and form state.
- Avoid effectrs for values that can be derived during render. Use memoization only when it prevents measured work or stabilizes a meaningful dependency.
- Use stable domain identifiers for list keys rather than array indexes.
- Name event handlers with a `handle` prefix and callback props with an `on` prefix.
- Keep forms keyboard accessible, associate every control with a label, and announce validation or server errors.
- Represent loading, error, empty, pending, and successful states where they apply.
- Show a Toast, when an action returns an error, or successfully passes.
- Send a Notification to the user, when an admin executed an action on a user (e.g. an admin accepted the project of a user)
- Extract a component or hook when doing so clarifies ownership or enabled genuine reuse, not solely to reduce line count.
- Preserve focus intentionally when opening and closing modal interfaces.

## CSS and Component conventions

- Use Tailwind CSS and follow the design guidelines already established by all shadcn/ui components inside `src/components/`
- Reuse existing Components before introducing new, or custom ones. 
- Never apply `className` to a component, either create a new style inside the component, or look for an already existing style that could match.
- Prefer low-specificity class selectors and avoid `!important` when writing CSS.
- Reuse existing custom propertiers and shared values before introducing new ones, when writing CSS.
- When using plain CSS, then follow the class-naming and file organization already established by nearby components.
- Use flexible layout primitives such as Grid and Flexbox instead of fixed positioning for page structure.
- Do not only design desktop-first, but also mobile-first where practical and verify that layouts remain usable at narrow and wide viewport sizes.
- Use relative units for scalable typography and spacing while retaining pixels where they are appropriate for borders or small fixed details.
- Provide visible `:focus-visible` (or `focus:` for TailwindCSS) styles for interactive controls and do not remove browser focus indicators without an accessbile replacement.
- Ensure hover-only information is also available to keyboard and touch users.
- Resepct `prefers-reduced-motion` when adding nonessential motion.
- Maintain sufficient text and control contrast against the dark interface.
- Keep transitions restrained and limited to properties that do not trigger unnecessary layout work.

## API conventions

API modules generally follow route → controller → repository. Existing servies may remain, but new business logic should be placed in controllers so HTTP and domain behavior can be understood together.

Routes should validate external input. Valibot is preffered, although straightforward string fields may use explicit checks to keep schemas simple. Repository classes own persistence, bur read-only routes may access exported collections directly when no business rules are involved.

Successful API responses should use:

´´´json
{ "data": {}, "meta": {} }
```

Errors should use:

```json
{ "errors": { "message": "Something went wrong", "status": 400 } }
```

Older endpoints use an error `code`; preserve that field when modifying those endpoints. New endpoints should use `status` so clients do not need a seperate code mapping.

Use conventional HTTP statuses. A duplicate resource can return either 400 or 409 depending on whether the conflict is discovered during validation or persistence.

## Web conventions

- Use TanStack QUery for lists and other cacheable server data.
- A component may use `fetch` directly for one-off actions that do not need caching.
- Keep components self-contained; colocate requests calls and local types with the component using them.
- Forms should use controlled inputs. React Hook Form is preferred  for forms with validation or more than two fields.
- Use existing colors and spacing where practical. New components may use Tailwind CSS custom properties to begin the design-token migration.

Include useful loading and error feedback. Empty states are required for primary pages but optional inside dialogs.
Use semantic HTML and support keyboard interaction. Follow-up accessbility improvements may be tracked separately when they would significantly increase the scope of a small feature.

## Testing

- Add unit tests for business logic and important utilities.
- API tests should exercise endpoints through the Elysia request helper.
- Integration-style API tests may start the development server when behavior depends on Node networking.
- UI tests should focus on user-visible outcomes rather than implemntation details.
- Snapshot tests are appropriate for stable component output.

Run the narrowest relevant tests during development. Before opening a pull request, run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm lint:md # Only when you modified markdown files, it is preferred, that you fix pre-existing errors/warnings rather than ignoring them.
pnpm format
pnpm build
```

## Git conventions

- Follow Conventional Commits whenever committing and pushing changes.
- Use the following commit message format:

  ```markdown
  <type>[optional scope]: <short description>

  [optional body]

  [optional footer(s)]
  ```

- Write a short, descriptive summary in the imperative mood that clearly communicates the change.
- Choose an appropriate type:
    - `feat`: Introduce a new feature
    - `fix`: Fix a bug.
    - `refactor`: Restructure code without changing its behavior.
    - `docs`: Add, remove or update documentation.
    - `test`. Add, remove or update tests.
    - `chore`: Perform maintenance tasks, such as updating dependencies.
    - `style`: Make formatting or stylistic changes that do not affect behavior.

- Use an optional scope to identify the affected area when it adds calrity, such as `feat(api): add project search enpoint`.
- Keep commit messages concise and focused. Add a body when additional context is needed, and use footers for references to issues or other relevant metadata.
- Indicate breaking changes by appending `!` to the type or scope (for example, `feat(api)!: change project response format`) and include a `BREAKING CHANGE:` footer when additional explanation is needed.
- Avoid vague commit messages such as `update`, `changes`, or `fix stuff`.

Example commit messages:

```markdown
feat: add project search
fix(auth): handle expired sessions
refactor: simplify project validation
docs: update API conventions
test: cover project creation
chore: update dependencies
```

## Delivery

Update documentation when behavior changes. Summarize the implementation, tests, and any follow-up work. If a full check fails for a  reason unrelated to the change, note it and rely on the focused package checks.