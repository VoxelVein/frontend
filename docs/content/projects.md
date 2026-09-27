# Projects and Files

Mods, modpacks, plugins, resource packs, shaders, and servers are
**projects**. Every type except servers has **versions**, and each
version has one or more uploaded **files**. Servers are listings with
join details instead. Metadata lives in Postgres,
files live in [object storage](../storage/object-storage.md), and
published projects are [searchable](../search/postgres.md) straight
from Postgres.

## Data model

Tables are defined in `src/db/schema.ts` (migration
`drizzle/0005_add_projects.sql`):

* `projects`: `slug` (unique, used in URLs), `type` (`mod`, `modpack`,
  `plugin`, `resourcepack`, `shader`, or `server`), `status` (`draft`,
  `pending`, `published`, or `removed`), owner, category, tags, summary,
  Markdown description, and a download counter.
* `project_versions`: version number (unique per project), release
  channel (`release`, `beta`, `alpha`), game versions, loaders or
  platforms, changelog, and a download counter.
* `project_files`: filename, size, SHA-1, SHA-512, storage key, and
  whether it is the version's primary file.
* `project_servers` (migration `drizzle/0010_add_project_servers.sql`):
  one row per server project with its address, optional port (empty means
  25565), and supported game versions.
* `project_server_links`: mods, modpacks, shaders, and resource packs a
  server links to, in any mix, each marked required or recommended.

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

## Who can do what

| Action                        | Who                                     |
| ----------------------------- | --------------------------------------- |
| View and download published   | Everyone                                |
| View a draft or a pending one | Owner and admins                        |
| Create a project              | Signed-in users with a verified email   |
| Edit, add versions, submit    | Owner (verified) and admins             |
| Approve or send back          | Admins                                  |
| Withdraw or unpublish         | Owner (verified) and admins             |
| Delete a version or project   | Owner (verified) and admins             |
| Remove a project (moderation) | Admins                                  |

Checks live in `src/lib/project-access.ts` and run on the server for
every mutation. Server functions are protected from cross-site requests
by the CSRF middleware in `src/start.ts`.

Password sign-ups cannot verify their email yet, because the app does not
send email. Until it does, only Google and GitHub accounts (verified by
the provider) and admins can upload.

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
4. An admin decides in `/admin?tab=reviews`:
   * **Approve** (`approveProject`) moves it to `published` and notifies
     the creator.
   * **Send back** (`rejectProject`) moves it to `draft` with a required
     reason, which the creator sees and can act on.

Two more transitions exist for the owner alone, neither of which is
moderated because neither makes anything public:

* **Withdraw request** (`withdrawProjectReview`) cancels a `pending`
  submission.
* **Unpublish** (`unpublishProject`) takes a live project back to draft.

Deleting the last file-bearing version of a published project moves it
back to draft, so a published project always has something to download.

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

## Server client requirements

Search derives each server's `clientRequirement` from its published links,
in SQL (`src/lib/search/projects.ts`) and in `clientRequirementFor`
(`src/lib/projects.ts`), which must agree: `required` when any link is
required, `recommended` when there are only optional links, and `vanilla`
when nothing is linked. The Servers page filters on it. Because it is
computed at query time, unpublishing a linked mod changes the server's
requirement right away.

## Search

Search reads these tables directly, so there is no index to sync after a
publish, edit, upload, or delete. See [Search](../search/postgres.md).

## Demo data

`pnpm db:seed` creates demo projects of every type owned by the first
admin. Each gets one version with a small generated archive; demo servers
get join details, and two of them link to demo content.

## Related

* [Object Storage](../storage/object-storage.md)
* [Search](../search/postgres.md)
* [API Server](../architecture/api.md)
