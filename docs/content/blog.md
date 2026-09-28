# Blog

The blog is a first-class content type, not a static page. Posts live in
the `posts` table, are written and edited from the admin panel, and are
searchable through Postgres like projects are.

## Pages

* `/blog` — the index. A `PageHeader`, a search field when search is
  available, and a responsive card grid of `PostCard`s.
* `/blog/$slug` — a single post. The date (`dateStyle: "long"`), title,
  excerpt, and the body rendered from Markdown with `@tanstack/markdown`.

The index and the post both have skeleton `pendingComponent`s, and the
search field shows result skeletons while a query is in flight.

`/blog/$slug` renders an inline "Post not found" message with a `200`
status. That is deliberate and different from `/u/$username`, which throws
a real 404: a blog slug is not linked from every page, so there is
nothing to gain from a hard failure, and a soft miss keeps a mistyped URL
from looking like a site error.

## Data model

`posts` is defined in `src/db/schema.ts` and created by
`drizzle/0004_add_posts.sql`:

| Column                     | Notes                                |
| -------------------------- | ------------------------------------ |
| `id`                       | Text key, generated server-side      |
| `slug`                     | Unique, used in the URL              |
| `title`                    | Required                             |
| `excerpt`                  | Optional summary                     |
| `content`                  | Required Markdown body               |
| `published`                | Drafts are invisible publicly        |
| `author_id`                | References `users`, cascading delete |
| `created_at`, `updated_at` | Timestamps                           |

Indexes: `posts_authorId_idx`, `posts_published_idx`, and the composite
`posts_published_createdAt_idx` that backs the published-by-date listing.

Validation and the card-preview machinery live in `src/lib/posts.ts`:

* `postTitleSchema`, `postSlugSchema`, `postContentSchema`, and the
  `postInputSchema` / `postUpdateSchema` pairs are shared by the admin form
  and the server functions.
* `slugify` derives a slug from the title in the form until the author
  edits the slug field by hand (`slugTouchedRef` in
  `post-form-dialog.tsx` stops the form overwriting it).
* `toPreview` produces the card text by stripping fenced and inline code,
  images, links, headings, blockquotes, lists, horizontal rules, HTML tags,
  and every emphasis form, then breaking at a word near 180 characters.
  Underscore emphasis is handled so `snake_case` survives.

## Server functions

`src/lib/posts.functions.ts` exposes the whole surface:

| Function              | Method | Purpose                             |
| --------------------- | ------ | ----------------------------------- |
| `listPosts`           | GET    | Published posts for the index       |
| `getLatestPosts`      | GET    | Recent posts for the home page news |
| `searchPosts`         | GET    | Public search over published posts  |
| `searchPostsAdmin`    | GET    | Same, including drafts (admin only) |
| `postSearchAvailable` | GET    | Whether there is anything to search |
| `getPost`             | GET    | One post by slug                    |
| `getPostById`         | GET    | One post by id, for editing         |
| `createPost`          | POST   | Create                              |
| `updatePost`          | POST   | Update                              |
| `deletePost`          | POST   | Delete                              |

## Writing posts

**Admin → Posts** (`/admin?tab=posts`) is a table of every post with a
Published/Draft badge, a search field, and create, edit, and delete
actions. `post-form-dialog.tsx` is a TanStack Form dialog with a live
Markdown preview of the body next to the editor.

`use-admin-posts.ts` owns that tab's state. It polls every 15 seconds
while `document.visibilityState !== "hidden"`, catches up immediately when
the tab becomes visible again, and guards against overlapping requests
with an in-flight ref and a mutation counter, so a response from before a
create or delete cannot overwrite newer state.

## Search

Post search is the same Postgres full-text and trigram approach as project
search, capped at 50 hits. See [Search](../search/postgres.md).

The search field is hidden entirely when `postSearchAvailable` returns
false, which only happens when no post is published: a search box over an
empty blog is a dead control.

`use-post-search.ts` debounces input by 300 ms and returns to the full
listing immediately when the query is cleared, so the unfiltered posts are
never hidden behind an empty result set.

## Related

* [Search](../search/postgres.md)
* [Migrations](../database/migrations.md)
* [Architecture Overview](../architecture/overview.md)
