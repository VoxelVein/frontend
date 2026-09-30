# Projects and Files

Mods, modpacks, plugins, resource packs, shaders, and servers are
**projects**. All six types are fully implemented: each has a browse page,
a detail page, a creator form, and search filters. Every type except
servers has **versions**, and each
version has one or more uploaded **files**. Servers are listings with
join details instead. Metadata lives in Postgres,
files live in [object storage](../storage/object-storage.md), and
published projects are [searchable](../search/postgres.md) straight
from Postgres.

## Pages

Each type has a browse page and a detail page:

| Type           | Browse            | Detail                  |
| -------------- | ----------------- | ----------------------- |
| `mod`          | `/mods`           | `/mods/$slug`           |
| `modpack`      | `/modpacks`       | `/modpacks/$slug`       |
| `plugin`       | `/plugins`        | `/plugins/$slug`        |
| `resourcepack` | `/resource-packs` | `/resource-packs/$slug` |
| `shader`       | `/shaders`        | `/shaders/$slug`        |
| `server`       | `/servers`        | `/servers/$slug`        |

All six browse pages render the same `ProjectBrowser` component with a
different type, so filters, sorting, pagination, the SSE live banner, and
the empty/error states behave identically everywhere. The category list
lives in one place, `src/lib/categories.ts`, and drives the navbar menu,
the navbar overflow menu, the footer, and the home page's explore grid, so
a category can never be advertised in one place and missing in another.

## Data model

Tables are defined in `src/db/schema.ts`:

* `projects`: `slug` (unique, used in URLs), `type` (`mod`, `modpack`,
  `plugin`, `resourcepack`, `shader`, or `server`), `status` (`draft`,
  `pending`, `published`, or `removed`), owner, category, tags, summary,
  Markdown description, and a download counter.
* `project_versions`: version number (unique per project), release
  channel (`release`, `beta`, `alpha`), game versions, loaders or
  platforms, changelog, and a download counter.
* `project_files`: filename, size, SHA-1, SHA-512, storage key, and
  whether it is the version's primary file.
* `project_servers` (migration `drizzle/0015_add_project_servers.sql`):
  one row per server project with its address, optional port (empty means
  25565), and supported game versions.
* `project_server_links`: mods, modpacks, shaders, and resource packs a
  server links to, in any mix, each marked required or recommended. A
  server links to at most `MAX_SERVER_LINKS` (20) projects.
* `project_images` (migration
  `drizzle/0016_add_project_images.sql`): a project's icon and gallery
  images in one table, with a `kind` of `icon` or `gallery`. A project has
  at most one icon, enforced by a partial unique index on `project_id` where
  `kind = 'icon'`. Rows carry the real pixel `width` and `height` so the UI
  can reserve the right box before the image loads, and deleting the
  project cascades them away. See
  [Object Storage](../storage/object-storage.md#images).
* `projects.is_protected`: set by an admin, keeps a project out of its
  owner's account deletion.
* `projects.pending_deletion`: hides a project immediately while its
  deletion is still reversible.

Shared constants and validation schemas (categories, loaders, slug rules,
URL paths per type) are in `src/lib/projects.ts`.

| Type           | URL               | Files               |
| -------------- | ----------------- | ------------------- |
| `mod`          | `/mods`           | `.jar`              |
| `modpack`      | `/modpacks`       | `.mrpack` or `.zip` |
| `plugin`       | `/plugins`        | `.jar`              |
| `resourcepack` | `/resource-packs` | `.zip`              |
| `shader`       | `/shaders`        | `.zip`              |
| `server`       | `/servers`        | None                |

Mods and modpacks list mod loaders, plugins list server platforms, and
shaders list shader loaders. Resource packs and servers have none.

## Game versions

The selectable Minecraft versions are every release and snapshot in
Mojang's launcher manifest. They are generated into
`src/lib/minecraft-version-manifest.ts`; run `pnpm mc:versions` after
Mojang ships a version and commit the result. Uploaders pick versions in
a searchable field: typing a line such as `1.20` offers to add all of its
releases at once, and snapshots stay hidden until "Show snapshots" is on.

## The creator dashboard

`/dashboard` is a guard plus an outlet; everything real lives in its
children:

* `/dashboard/projects` — the creator's projects
* `/dashboard/projects/new` — create a project
* `/dashboard/projects/$projectId?tab=` — `details`, `images`, `versions`,
  or `danger`

The description field on both forms has a **Preview** toggle that renders
the Markdown beside the editor, so formatting can be checked without saving
and navigating away. It reuses `MarkdownPreview`
(`src/components/markdown-preview.tsx`), the same component the blog post
editor uses, so a preview always matches the published output.

The preview starts closed because the project form is long, and a
permanently open preview pushes the fields below it further down. The blog
post dialog has the room and shows its preview without a toggle.

`/dashboard` redirects anyone whose `usernameConfirmed` is `false` to
`/welcome` first, so a Google or GitHub account picks its username before
it can create anything.

## Who can do what

| Action                        | Who                                   |
| ----------------------------- | ------------------------------------- |
| View and download published   | Everyone                              |
| View a draft or a pending one | Owner and staff                       |
| Create a project              | Signed-in users with a verified email |
| Edit, add versions, submit    | Owner (verified) and staff            |
| Approve or send back          | Staff (moderator and up)              |
| Withdraw or unpublish         | Owner (verified) and staff            |
| Delete a version or project   | Owner (verified) and staff            |
| Mark a project as large       | Admins                                |
| Remove a project (moderation) | Admins                                |

Checks live in `src/lib/project-access.ts` and run on the server for
every mutation. Server functions are protected from cross-site requests
by the CSRF middleware in `src/start.ts`, and the upload route additionally
rejects a cross-origin `Origin` header rather than relying on the session
cookie alone.

"Staff" means `moderator` or `admin`; the roles are a ladder in
`ROLE_RANK` (`src/lib/roles.ts`) and every check calls `hasRole(role,
minimum)`. A moderator can reach a project they do not own because
reviewing a submission means reading it. See
[Admin Panel](admin-panel.md#roles) for the full matrix.

Password sign-ups cannot verify their email yet, because the app does not
send email. Until it does, only Google and GitHub accounts (verified by
the provider) and staff can upload. The dashboard shows a
`VerificationNotice` and hides the "New project" action for everyone else.

## Creating and publishing

Publishing is a **moderated** two-step flow. A creator cannot make a project
public; only an admin can.

1. `/dashboard/projects/new` creates a **draft**
   (`createProject` in `src/lib/projects.functions.ts`).
2. On `/dashboard/projects/<id>?tab=versions`, the owner creates a
   version (`createVersion`) and uploads its file. For servers the same
   tab is called "Server" and saves the join details and linked content
   (`saveServerDetails`). New links must point at published projects.
3. **Submit for review** (`submitProjectForReview`) moves the draft to
   `pending`, once at least one version exists, or for servers once join
   details are saved. The project stays hidden from the site.
4. A moderator or admin decides in `/admin?tab=reviews`:
   * **Approve** (`approveProject`) moves it to `published` and notifies
     the creator.
   * **Send back** (`rejectProject`) moves it to `draft` with a required
     reason (max 2000 characters), which the creator sees and can act on.

Two more transitions exist for the owner alone, neither of which is
moderated because neither makes anything public:

* **Withdraw request** (`withdrawProjectReview`) cancels a `pending`
  submission.
* **Unpublish** (`unpublishProject`) takes a live project back to draft.

Deleting the last file-bearing version of a published project moves it
back to draft, so a published project always has something to download.
The current status drives the available transitions, and the panel on the
project's manage page shows only the ones that apply.

A creator sees the outcome through the notification bell in the navbar,
which lists `project-approved` and `project-rejected` notifications. These
are the only two kinds
(`USER_NOTIFICATION_TYPES` in `src/lib/notifications.ts`).

### Why `pending` is a status and not a flag

Every public read path already filters on `status = 'published'` — search,
the public project page, downloads, trending and the search document. A
project in `pending` therefore disappears from all of them with no change
to any of those queries, which is why adding the status was enough to make
review work.

There is deliberately no `rejected` status. A rejection returns the project
to `draft` and records why in `rejection_reason`, so the creator can fix it
and resubmit instead of being parked in a terminal state.

### Audit columns

* `submitted_at` — set when review is requested, cleared by any decision.
* `reviewed_at` — set by a decision, never cleared.
* `reviewed_by` — the deciding admin, never cleared.
* `rejection_reason` — set by a rejection, cleared on resubmission or
  approval.

`reviewed_by` is a soft reference: if the reviewing admin's account is
deleted it becomes null rather than removing the review record.

### Deploying the review step

Migration `0013_queue_published_projects_for_review.sql` moves every
already-`published` project into the queue. **It must not be deployed
before the `/admin` Reviews tab exists**, or the entire catalogue goes
invisible with no way to approve it back. It is kept as a separate file
from the `0012` DDL precisely so that one step can be held back.

## Upload flow

The browser sends the raw file with
`PUT /api/projects/<projectId>/versions/<versionId>/files?filename=…`
(`src/routes/api/projects.$projectId.versions.$versionId.files.ts`).
The route:

1. Rejects requests whose `Origin` is not the app's own origin.
2. Checks the session, ownership, and that the version belongs to the
   project.
3. Accepts only names with an extension the project type allows (see the
   table above) made of letters, numbers, `.`, `-`, `_`, and `+`. The
   client rewrites other characters before uploading. Servers take no
   files.
4. Checks the `PK\x03\x04` zip signature, then streams the body to
   storage while hashing it.

| Status | Meaning                                           |
| ------ | ------------------------------------------------- |
| `201`  | Stored; the body is the new file                  |
| `401`  | Not signed in                                     |
| `403`  | Not the owner, unverified, or cross-origin        |
| `404`  | Unknown project or version                        |
| `409`  | The version already has a file with that name     |
| `413`  | Larger than `STORAGE_MAX_FILE_BYTES`              |
| `415`  | Wrong file type for the project, or a server      |
| `503`  | Storage is not configured or unreachable          |
| `507`  | The storage quota (`STORAGE_QUOTA_BYTES`) is full |

## Download flow

`GET /api/download/<fileId>` (`src/routes/api/download.$fileId.ts`)
only serves files of published projects. It increments the version and
project download counters, then redirects (`302`) to the storage URL.
Download links work without JavaScript or Turnstile, so launchers and
scripts can use them.

Every request gets the redirect, but only plausible downloads are counted
(`src/lib/download-counter.ts`):

* Prefetch and prerender requests (`Sec-Purpose`, `Purpose`, `X-Moz`
  headers) are never counted.
* Each client counts at most once per file per 24 hours. Signed-in users
  are keyed by account; anonymous users by the last `X-Forwarded-For`
  entry when `TRUST_PROXY=true`.
* Anonymous clients that cannot be identified share one bucket per file,
  which undercounts rather than letting a request loop inflate the
  counters. Set `TRUST_PROXY=true` behind a reverse proxy to avoid this.

The dedup cache is in memory, so it resets on restart and is per process.

## Images

A project has an optional icon and up to `GALLERY_MAX_COUNT` (12) gallery
images, managed on the dashboard project's `images` tab. Both go through
`PUT /api/projects/$projectId/images?kind=icon|gallery`, and are removed with
`DELETE /api/projects/$projectId/images/$imageId`.

They are stored in object storage like version files, but are kept separate
from them in every way that matters:

* The upload is not an archive, so the zip-magic check does not apply.
  Instead the type is sniffed from the file's leading bytes, and SVG is
  rejected outright.
* Uploading a new icon **replaces** the old one in the same transaction,
  then deletes the superseded object, so a project never accumulates icons.
* `GET /api/image/$imageId` serves the bytes, and applies the same
  published-and-not-pending-deletion rule as a file download. A draft
  project's icon is therefore not readable by anyone who guesses its id.
* Images never affect a version's or a project's download counter.

Nothing is resized. The stored `width` and `height` let the UI reserve the
correct box, which avoids layout shift, but the file itself is what was
uploaded. `ROADMAP.md` records the resizing options and their trade-offs.

## Server client requirements

Search derives each server's `clientRequirement` from its published links,
in SQL (`src/lib/search/projects.ts`) and in `clientRequirementFor`
(`src/lib/projects.ts`), which must agree: `required` when any link is
required, `recommended` when there are only optional links, and `vanilla`
when nothing is linked. The Servers page filters on it. Because it is
computed at query time, unpublishing a linked mod changes the server's
requirement right away.

A server's public page shows the join address with a copy button, the
linked content split into required and recommended, and the client
requirement derived from those links.

## Search

Search reads these tables directly, so there is no index to sync after a
publish, edit, upload, or delete. See [Search](../search/postgres.md).

## Discovery

The home page loads from Postgres too, and all of it is refetched in the
background rather than on every render:

* **Trending** — the most active published projects, recomputed at most
  once a minute on the server and polled every 60 seconds
  (`TRENDING_REFRESH_MS` in `src/lib/trending.functions.ts`).
* **Explore** — the six category tiles from `src/lib/categories.ts`.
* **News** — the latest published blog posts, polled every five minutes
  (`POSTS_REFRESH_MS`).

## Demo data

`pnpm db:seed` runs both seeders against the first admin in the database:

* `pnpm db:seed:projects` — demo projects of every type, each with one
  version and a small generated archive uploaded to storage. Demo servers
  get join details, and two of them link to demo content, one required and
  one with three optional links.
* `pnpm db:seed:posts` — published demo blog posts, so the blog and the
  home page news section are not empty. Re-running leaves existing posts
  alone.

`pnpm db:seed:admin` promotes an existing account to `admin`, which is
required first: both seeders attach their content to the first admin.

## Related

* [Object Storage](../storage/object-storage.md)
* [Search](../search/postgres.md)
* [Accounts](../authentication/accounts.md)
* [Architecture Overview](../architecture/overview.md)
* [API Server](../architecture/api.md)
