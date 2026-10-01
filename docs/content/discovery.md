# Discovery

How the home page decides what to show: the trending ranking, the
category registry behind both project menus, and the explore grid.

## Trending

Five projects on the landing page, ranked by "popular and recently
active". Downloads are only ever stored as a running total, so recency has
to come from somewhere else.

### The score

`trendingScore` (`src/lib/trending.ts:29`) multiplies two terms:

```text
popularity = log10(downloads + DOWNLOAD_PRIOR)
boost      = MAX_RELEASE_BOOST * 0.5 ** (ageDays / TRENDING_HALF_LIFE_DAYS)
score      = popularity * (1 + boost)
```

| Constant | Value | Why |
| --- | --- | --- |
| `TRENDING_HALF_LIFE_DAYS` | 3 | The boost halves every three days |
| `MAX_RELEASE_BOOST` | 4 | With the `1 +`, a release made now scores up to 5x |
| `DOWNLOAD_PRIOR` | 10 | Keeps a zero-download project in the running |
| `TRENDING_LIMIT` | 5 | Slots on the landing page |

The logarithm is what stops one popular project from holding every slot: a
project with a hundred times the downloads does not score a hundred times
the points, so a small fresh project can still outrank a large stale one.

`pickTrending` (`src/lib/trending.ts:54`) then takes the top `limit` ids in
one ordered pass, using `findIndex` over a list capped at `limit` rather
than sorting every candidate. Ties break on raw download count, so equal
scores resolve in favour of the bigger project.

### What counts as recent

`lastActivityAt` is the newest version upload, falling back to the publish
date and then the update date (`src/lib/trending.functions.ts:20`):

```sql
coalesce(max(project_versions.created_at), projects.published_at, projects.updated_at)
```

The `max()` over versions is the important part: a new upload revives an
old project. Without it, a five-year-old mod with a new version would rank
on its original publish date and never trend again.

Only `status = 'published'` and not `pendingDeletion` rows are eligible
(`src/lib/trending.functions.ts:28`).

### Caching, and what it costs

The list is computed at most once per `TRENDING_REFRESH_MS` (60 s) per
process (`src/lib/trending.functions.ts:11`). Two consequences worth
knowing before scaling up:

* The cache is a module-level variable, so **each replica keeps its own**,
  and there is no in-flight guard. A cold cache under a burst of traffic
  runs the query once per concurrent request until it is filled.
* The candidate query has no `LIMIT`. It returns one row per published
  project, and ranking happens in JavaScript. It is a single indexed scan
  with a `LEFT JOIN` and `GROUP BY`, so it is cheap at small scale and the
  first thing to move into a window function if the catalogue grows large.
* Building each winner's document is a separate `buildProjectDocument`
  call (`src/lib/trending.functions.ts:33`), so five winners cost six
  queries.

The client polls at the same 60 s interval and seeds `initialData` from
the loader, so the list never flashes empty on refresh
(`src/components/trending-projects.tsx:22`).

### Tweaking it

Both constants are exported and the module has tests in
`src/lib/__tests__/`. `trendingScore` takes `now` as a parameter rather
than reading the clock, which is what makes those tests deterministic.

## Categories

`src/lib/categories.ts` is the single source of truth for both the
navbar's project menu and the landing page's explore grid. One list, so a
category's route or availability cannot drift between the two surfaces.

Each entry carries two flags:

`available`
: Whether the browse route exists. An unavailable category renders as
  "coming soon" instead of linking, so nothing advertises a destination
  that 404s.

`alwaysInline`
: Whether it appears in the navbar from `lg`. The rest wait for `xl` and
  sit in the navbar's **More** menu until then, which keeps every category
  reachable at every width.

Array order is the display order — the navbar and the explore grid both
render the list in sequence, so reordering the array moves entries in both
places at once.

## Related

* [Projects and Files](projects.md) — the six project types these
  categories group
* [Search](../search/postgres.md) — the other discovery surface
* [Motion](motion.md) — the reveal animation on these sections
