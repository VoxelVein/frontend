# Blog

The blog is a first-class content type, not a static page. Posts live in
the `posts` table, are written and edited from the admin panel, and are
searchable through Postgres like projects are.

## Pages

* `/blog` — the index, in `blog.index.tsx`. A `PageHeader`, a search
  field when search is available, and a responsive card grid of
  `PostCard`s.
* `/blog` (layout) — `blog.tsx`. Renders `<Outlet />` and nothing else.
* `/blog/$slug` — a single post. The date (`dateStyle: "long"`), title,
  excerpt, and the body rendered from Markdown.

The index has its own file because `blog.tsx` is the *parent* of
`/$slug`. A parent route with children must render an `Outlet`; when one
renders its own content instead, the child never mounts — the URL changes
and the child's loader runs, but the parent keeps painting the list. That
is exactly the bug this split fixed: `/blog/$slug` was reachable, looked
correct in the URL bar, and silently showed the index.

Moving the listing into the index route also stops `/blog/$slug` from
fetching every post and probing search availability on the way to a single
post.

The index and the post both have skeleton `pendingComponent`s, and the
search field shows result skeletons while a query is in flight.

`/blog/$slug` renders an inline "Post not found" message with a `200`
status. That is deliberate and different from `/u/$username`, which throws
a real 404: a blog slug is not linked from every page, so there is
nothing to gain from a hard failure, and a soft miss keeps a mistyped URL
from looking like a site error.

## Markdown

Every Markdown surface — the post body, the editor preview, project
descriptions, and profile bios — renders through `MarkdownBody`
(`src/components/markdown-body.tsx`), so the four places that show
author-written content cannot disagree about what a newline means.

That wrapper puts `white-space: pre-wrap` on paragraphs and nowhere else.
Standard Markdown treats one newline as a *soft* break, which HTML
collapses to a space, so a line break the author pressed Enter for
silently disappears. The alternatives are all worse: two trailing spaces
would be the real Markdown answer but `@tanstack/markdown` emits a soft
break for those too, a raw `<br>` is escaped because `allowHtml` is off,
and a trailing backslash works but makes authors type a hidden character
for a visible result.

Scoping it to `p` is what keeps code fences, lists, and tables intact, and
keeps stored Markdown CommonMark-clean and portable — nothing rewrites
the author's text. The trade is that runs of spaces and paragraph
indentation are now preserved rather than collapsed, which is what GitHub,
Discord, and every modern comment box already do.

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
  `post-form-page.tsx` stops the form overwriting it).
* `toPreview` produces the card text by stripping fenced and inline code,
  images, links, headings, blockquotes, lists, horizontal rules, HTML tags,
  and every emphasis form, then breaking at a word near 180 characters.
  Underscore emphasis is handled so `snake_case` survives.

## Server functions

`src/lib/posts.functions.ts` exposes the whole surface:

| Function              | Method | Purpose                             |
| --------------------- | ------ | ----------------------------------- |
| `listPosts`           | GET    | Posts for the index and admin tab   |
| `getLatestPosts`      | GET    | Recent posts for the home page news |
| `searchPosts`         | GET    | Public search over published posts  |
| `searchPostsAdmin`    | GET    | Same, including drafts              |
| `postSearchAvailable` | GET    | Whether there is anything to search |
| `getPost`             | GET    | One post by slug                    |
| `getPostById`         | GET    | One post by id, for editing         |
| `createPost`          | POST   | Create, always a draft              |
| `updatePost`          | POST   | Update a post                       |
| `deletePost`          | POST   | Delete a post                       |

Capabilities are enforced on the server rather than in the form:

| Function                              | Requires       |
| ------------------------------------- | -------------- |
| `listPosts` with `includeUnpublished` | `managePosts`  |
| `searchPostsAdmin`                    | `managePosts`  |
| `createPost`, `updatePost`            | `managePosts`  |
| `getPostById`, `deletePost`           | `publishPosts` |

The public read paths (`listPosts`, `getLatestPosts`, `searchPosts`,
`postSearchAvailable`, `getPost`) require nothing. `getPost` additionally
lets a caller who passes `getStaffSessionOrNull()` read an unpublished
post, which is how the editor previews a draft at its own slug.

## Writing posts

**Admin → Posts** (`/admin?tab=posts`) lists every post with a
Published/Draft badge, a search field with a clear affordance, and a
**New post** action. Each row links to that post's editor and offers
delete.

The whole tab, and the editor with it, is **admin-only**. It sits behind
the `managePosts` capability, which a moderator does not hold, so the
Posts tab is not rendered for them and `/admin/posts/*` redirects. See
[Roles](admin-panel.md#what-each-role-actually-gets).

### The editor is a page, not a dialog

Editing happens at `/admin/posts/new` and `/admin/posts/$postId/edit`,
both rendering `post-form-page.tsx`. They are separate routes rather than
a dialog over the tab because a dialog can only start fetching once it is
already open, so every edit began by showing empty fields and then filling
them in. The edit route now fetches its post in the **loader**, so the
form is populated on first paint, and the browser's back button leaves the
editor instead of closing a layer.

The page is two columns on large screens: the form on the left, and a live
`MarkdownPreview` of the body on the right in a sticky column, with a
sticky footer for the save actions. The form is a TanStack Form sharing
the schemas in `src/lib/posts.ts`.

### Drafting and publishing are separate capabilities

Writing a post and publishing one are different decisions, so they are
different capabilities: `managePosts` covers drafts, `publishPosts` covers
the flag. **Both are admin-only today**, so the split is not currently
reachable — no role can draft without being able to publish. It is kept
apart anyway so that the day drafting is opened up to moderators,
publishing does not follow by accident.

The distinction is enforced on the server in `posts.functions.ts` rather
than in the form, so the UI cannot be bypassed:

* `createPost` requires `managePosts` and forces `published: false` for
  anyone without `publishPosts`, whatever the request asked for.
* `updatePost` requires `managePosts` and gives a non-publisher no
  control over the flag in **either** direction — publishing a draft and
  unpublishing a live post are both publishing decisions, so the stored
  value wins either way.
* `deletePost` and `getPostById` require `publishPosts`. The second is why
  the edit page is admin-only even for a draft.

`use-admin-posts.ts` owns that tab's state. It polls every 15 seconds
while `document.visibilityState !== "hidden"`, catches up immediately when
the tab becomes visible again, and guards against overlapping requests
with an in-flight ref and a mutation counter, so a response from before a
create or delete cannot overwrite newer state. A background refresh never
shows a loading state and never reports an error — the list already on
screen beats interrupting an admin over a refresh they never asked for.

A separate `POSTS_REFRESH_MS` (5 minutes) governs the home page news
section through TanStack Query, not this tab.

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

* [Admin Panel](admin-panel.md)
* [Search](../search/postgres.md)
* [Migrations](../database/migrations.md)
* [Architecture Overview](../architecture/overview.md)
