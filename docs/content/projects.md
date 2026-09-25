# Projects and Files

Mods and plugins are **projects**. A project has **versions**, and each
version has one or more uploaded **files**. Metadata lives in Postgres,
files live in [object storage](../storage/object-storage.md), and
published projects are indexed in [Meilisearch](../search/meilisearch.md).

## Data model

Tables are defined in `src/db/schema.ts` (migration
`drizzle/0005_add_projects.sql`):

* `projects`: `slug` (unique, used in URLs), `type` (`mod` or `plugin`),
  `status` (`draft`, `published`, or `removed`), owner, category, tags,
  summary, Markdown description, and a download counter.
* `project_versions`: version number (unique per project), release
  channel (`release`, `beta`, `alpha`), game versions, loaders or
  platforms, changelog, and a download counter.
* `project_files`: filename, size, SHA-1, SHA-512, storage key, and
  whether it is the version's primary file.

Shared constants and validation schemas (categories, loaders, plugin
platforms, slug rules) are in `src/lib/projects.ts`.

## Who can do what

| Action                        | Who                                     |
| ----------------------------- | --------------------------------------- |
| View and download published   | Everyone                                |
| View a draft                  | Owner and admins                        |
| Create a project              | Signed-in users with a verified email   |
| Edit, add versions, publish   | Owner (verified) and admins             |
| Delete a version or project   | Owner (verified) and admins             |
| Remove a project (moderation) | Admins                                  |

Checks live in `src/lib/project-access.ts` and run on the server for
every mutation. Server functions are protected from cross-site requests
by the CSRF middleware in `src/start.ts`.

Password sign-ups cannot verify their email yet, because the app does not
send email. Until it does, only Google and GitHub accounts (verified by
the provider) and admins can upload.

## Creating and publishing

1. `/dashboard/projects/new` creates a **draft**
   (`createProject` in `src/lib/projects.functions.ts`).
2. On `/dashboard/projects/<id>?tab=versions`, the owner creates a
   version (`createVersion`) and uploads its file.
3. `setProjectPublished` publishes the project once at least one file
   exists. Unpublishing moves it back to draft.

Deleting the last file-bearing version of a published project moves it
back to draft, so a published project always has something to download.

## Upload flow

The browser sends the raw file with
`PUT /api/projects/<projectId>/versions/<versionId>/files?filename=…`
(`src/routes/api/projects.$projectId.versions.$versionId.files.ts`).
The route:

1. Rejects requests whose `Origin` is not the app's own origin.
2. Checks the session, ownership, and that the version belongs to the
   project.
3. Accepts only `.jar` names made of letters, numbers, `.`, `-`, `_`, and
   `+`. The client rewrites other characters before uploading.
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
| `415`  | Not a `.jar` file                                 |
| `503`  | Storage is not configured or unreachable          |
| `507`  | The storage quota (`STORAGE_QUOTA_BYTES`) is full |

## Download flow

`GET /api/download/<fileId>` (`src/routes/api/download.$fileId.ts`)
only serves files of published projects. It increments the version and
project download counters, then redirects (`302`) to the storage URL.
Download links work without JavaScript or Turnstile, so launchers and
scripts can use them.

Download counts are not deduplicated or rate limited yet. The search
index picks up new counts when a project changes or on
`pnpm db:reindex`.

## Search sync

`src/lib/search-sync.ts` writes a project's search document after every
publish, edit, upload, or delete. It uses `MEILI_ADMIN_KEY`, a key limited
to `documents.add` and `documents.delete` on the `projects` index. If the
key is missing or Meilisearch is down, the write still succeeds and the
index catches up on the next change or reindex.

## Demo data

`pnpm db:seed` creates demo mods and plugins owned by the first admin.
Each gets one version with a small generated `.jar`. The command then
rebuilds the search index. `pnpm db:reindex` only rebuilds the index.

## Related

* [Object Storage](../storage/object-storage.md)
* [Meilisearch](../search/meilisearch.md)
* [API Server](../architecture/api.md)
