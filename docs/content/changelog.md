# Changelog page

The public `/changelog` page turns GitHub releases into a filterable timeline.
The repository's [CHANGELOG](../../CHANGELOG.md) is the authoring record; this
page is what visitors read.

## Where the data comes from

`listGithubReleases` (`src/lib/github-releases.functions.ts`) fetches
`https://api.github.com/repos/VoxelVein/frontend/releases?per_page=100`.
`per_page` matters: the default is 30, which would silently drop older
releases once the project passes that many tags. One request covers the whole
history, so there is no pagination to terminate.

The payload is untrusted. `parseGithubReleases` (`src/lib/github-releases.ts`)
narrows it with a Valibot schema, drops drafts, and sorts newest first. A
malformed response throws rather than reaching a component as `any`. A module
cache of five minutes keeps navigation inside GitHub's unauthenticated rate
limit; `GITHUB_TOKEN` is optional and only raises that limit.

Notes are filtered when rendered, not when fetched. `MarkdownBody` parses the
Markdown with raw HTML disabled and filters author URLs at parse time, the same
path blog posts and project descriptions use. Raw release HTML is never
injected.

## Categories and milestones

`src/lib/changelog.ts` holds the presentation rules:

* Categories (`features`, `fixes`, `breaking`) come from the release-note
  headings, so a filter cannot disagree with what a release actually says. A
  `BREAKING CHANGE` note in the body counts too.
* Anchors are derived from the tag (`ALPHA-0.18.0` becomes
  `release-alpha-0.18.0`) and used by both the jump list and the card id.
* Milestones mark breaking releases, the first `ALPHA-` prefixed tag, and a
  jump of two or more minor versions. The label is visible on the card, so a
  marker is never an unexplained ornament. The generated notes' leading
  `# version (date)` heading is removed before rendering, because the card
  already shows the version and date.

The filter uses toggle buttons inside a `fieldset` with `aria-pressed`, rather
than tabs: narrowing a list does not change pages. A live region announces the
result count, and an empty state offers a way back to all releases.

## Failure states

A GitHub outage or rate-limit response rejects the loader, which renders a
"Changelog unavailable" error with a retry action. An empty release list is a
different case and gets its own "No releases yet" state.

## Related

* [Project releases](projects.md), where version changelogs are authored
* [Blog](blog.md), the other Markdown-rendering surface
