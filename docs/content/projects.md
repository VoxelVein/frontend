# Projects and Files

Mods, modpacks, plugins, resource packs, shaders, datapacks, and servers
are **projects**. All seven types are fully implemented: each has a browse
page, a detail page, a creator form, and search filters. Every type except
servers has **versions**, and each version has one or more uploaded
**files**. Servers are listings with join details instead. Metadata lives in
Postgres, files live in
[object storage](../storage/object-storage.md), and published projects are
[searchable](../search/postgres.md) straight from Postgres.

## Pages

Each type has a browse page and a detail page:

| Type           | Browse              | Detail                    |
| -------------- | ------------------- | ------------------------- |
| `mod`          | `/p/mods`           | `/p/mods/$slug`           |
| `modpack`      | `/p/modpacks`       | `/p/modpacks/$slug`       |
| `plugin`       | `/p/plugins`        | `/p/plugins/$slug`        |
| `resourcepack` | `/p/resource-packs` | `/p/resource-packs/$slug` |
| `shader`       | `/p/shaders`        | `/p/shaders/$slug`        |
| `datapack`     | `/p/datapacks`      | `/p/datapacks/$slug`      |
| `server`       | `/p/servers`        | `/p/servers/$slug`        |

All seven browse pages render the same `ProjectBrowser` component with a
different type, so filters, sorting, pagination, the SSE live banner, and
the empty/error states behave identically everywhere. The category list
lives in one place, `src/lib/categories.ts`, and drives the navbar menu,
the navbar overflow menu, the footer, and the home page's explore grid, so
a category can never be advertised in one place and missing in another.

`/p` is the project namespace, mirroring `/u` for users. The browse pages
use the shared page frame: a `PageHeader` with the type's icon, a bordered
search-and-filter card, and a results section with a total. The old
top-level paths (`/mods`, `/servers`, and their detail and gallery paths)
remain as redirect-only routes so bookmarks and indexed links keep working;
`legacyProjectRedirect` builds the target from `PROJECT_TYPE_PATHS`.

### The detail pages are two components, not one

The seven detail routes split into two components, because the types do not
share a subject. Six of them are downloads and render `ProjectDetail`; a
server is a place you go, not a file you fetch, and renders `ServerDetail`.

Both share the standard page shell: the back link and name use the same
`PageHeader` and `max-w-7xl` rhythm as Settings and the project editor,
with a plain summary and a compact stat row underneath. The old dimmed
gallery backdrop, brand eyebrow, oversized icon and boxed stat strip are
gone, so a detail page reads like the rest of the site. The action column
sits on the right from `lg` up, with long-form content beside it. Each
sidebar answers the same two questions in the same order, *can I use
this*, then *how do I get it*, and each leads the DOM, so the priority
holds on mobile and for a screen reader alike rather than depending on
where the sidebar happens to sit.

| Type                 | Sidebar                                     |
| -------------------- | ------------------------------------------- |
| the six downloadable | newest version and file, then compatibility |
| `server`             | address, versions, then client requirements |

The byline reads *Created by \<name\>*. `loadProjectView` selects the
owner's `image` alongside their name, and `ProjectView.authorImage` carries
it to the page. The picture is rendered only when it is present and passes
`isSafeAvatarSrc`; an account without one shows the name alone, with no
initial tile standing in for a photo it never uploaded. A project kept
after its owner deleted their account has both fields null.

The download used to be the last section on the page, below the
description and the gallery, and the join address below the stats, the
summary, and the description. In both cases the one thing a visitor came
for was the last thing on screen. The full version history stays in the
main column, it does not fit in a card, under the title *Version
history*, since the sidebar now shows the current version and two
sections called *Versions* read as a duplicate.

`hasLoaders(type)` decides whether the compatibility card shows a loader
block at all. Resource packs and datapacks have no such axis, so the card
drops it rather than printing an empty one. The heading reuses
`LOADER_LABELS`, so a Paper plugin reads *Platforms* and a mod reads
*Loaders*, the same words the publish form and the browse filter use.

## Subcategories

Content types and subcategories are two different things, and both are often
called "category":

Top-level types
: The six sections in `src/lib/categories.ts`, each with its own route.
  `available` gates whether the browse route exists yet.

Subcategories
: A project type's own `category` column. One list per type in
  `CATEGORIES_BY_TYPE` (`src/lib/projects.ts`), `SERVER_CATEGORIES`,
  `PLUGIN_CATEGORIES`, and so on. Servers carry gamemodes such as `town`
  for CityBuild servers, `plots`, `skyblock`, and `prison`; plugins carry
  purposes such as `economy` and `protection`.

The project form offers these common values plus **Other…**, which lets a
creator enter a custom category. Custom categories are trimmed, lowercased,
and limited to 40 characters. Browse filters combine the common values with
the categories present in the search facets, so custom values remain
filterable. `formatCategory` (`src/lib/format.ts`) formats both known slugs and
custom values for the form, filter, and project page.

`projects.category` is a plain `text` column validated in app code, not a
database enum. Extending a list therefore needs no migration and cannot
break existing rows, as long as the old values stay. The trade-off is that a
list change is invisible to the database: the app is the only thing enforcing
it, and removing a value is the only edit that can strand a row with a
category no filter can select. Search values are bound SQL parameters; unlike
loaders and game versions, categories are not restricted to a fixed allowlist.

Server cards show live player counts when a Java or Bedrock status query
returns them. Status lookups are batched per page and cached in memory for one
minute. The app queries [mcstatus.io](https://mcstatus.io/docs); if a server is
offline, hides its count, or cannot be reached, the card shows an unavailable
count instead.

That is also why `formatCategory` looks its labels up in a **`Map`**, not a
plain object. A `value in LABELS` check walks the prototype chain, so a
stored category of `constructor` or `toString` matched `Object.prototype`
and returned the *function*, which reached React as a child and threw. A
`Map` consults only its own entries, so a hostile slug misses and takes the
fallback path, which title-cases the slug and turns `-` into a space. Any
lookup keyed by user-influenced data should follow the same rule.

## Disclosures

Creators can attach disclosures to a project so readers know how it was
made or what it depends on. A disclosure is project-level rather than
per-version: an AI-assisted icon, a translated description, or a
discontinued release describes the listing as a whole. Every ticked type
requires a description, because the label alone leaves the reader guessing
("Statistics" does not say which data was used).

There are seven types, defined once in `DISCLOSURE_TYPES` and labelled by
`DISCLOSURE_TYPE_LABELS` (`src/lib/projects.ts`):

| Value              | Label                |
| ------------------ | -------------------- |
| `ai-generated`     | AI-generated content |
| `statistics`       | Statistics           |
| `early-access`     | Early access         |
| `fan-content`      | Fan content          |
| `personal-content` | Personal content     |
| `translation`      | Translation          |
| `discontinued`     | Discontinued         |

`projectInputSchema` and `projectUpdateSchema` validate the list: at most
seven entries, each type at most once, each description trimmed and capped
at 400 characters. The creator dashboard's `ProjectDisclosures` fieldset
(`src/components/dashboard/project-disclosures.tsx`) ticks types and expands
a description field for each one. Both `ProjectDetail` and `ServerDetail`
show the disclosures in a **Transparency** section when any are set.

The values live in `projects.disclosures`, a `jsonb` column defaulting to
`[]` (migration `drizzle/0029_project_disclosures.sql`). It is JSON rather
than a table because a project has at most seven entries and nothing queries
into them, and because the types are validated in app code  -  extending the
list needs no migration.

## Data model

Tables are defined in `src/db/schema.ts`:

* `projects`: `slug` (unique, used in URLs), `type` (`mod`, `modpack`,
  `plugin`, `resourcepack`, `shader`, `datapack`, or `server`), `status` (`draft`,
  `pending`, `published`, or `removed`), owner, category, tags, summary,
  Markdown description, creator disclosures, and a download counter.
* `project_versions`: version number (unique per project), release
  channel (`release`, `beta`, `alpha`), game versions, loaders or
  platforms, changelog, and a download counter.
* `project_files`: filename, optional platform target, size, SHA-1, SHA-512,
  storage key, and whether it is the version's primary file. Modpack releases
  can include one independently replaceable download per launcher/platform;
  all files remain attached to the same release metadata and version number.
* `project_servers` (migration `drizzle/0015_add_project_servers.sql`):
  one row per server project with its address, optional port (empty means
  25565), and supported game versions.
* `project_server_links`: mods, modpacks, shaders, resource packs, and
  datapacks a server links to, in any mix, each marked required or
  recommended. Plugins are excluded, the server itself runs those. A
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

| Type           | URL                 | Files               |
| -------------- | ------------------- | ------------------- |
| `mod`          | `/p/mods`           | `.jar`              |
| `modpack`      | `/p/modpacks`       | `.mrpack` or `.zip` |
| `plugin`       | `/p/plugins`        | `.jar`              |
| `resourcepack` | `/p/resource-packs` | `.zip`              |
| `shader`       | `/p/shaders`        | `.zip`              |
| `datapack`     | `/p/datapacks`      | `.zip`              |
| `server`       | `/p/servers`        | None                |

Mods and modpacks list mod loaders, plugins list server platforms, and
shaders list shader loaders. Resource packs, datapacks, and servers have
none: a datapack has no loader because the game reads it straight out of
the world's `datapacks` folder.

## Game versions

The selectable Minecraft versions are every release and snapshot in
Mojang's launcher manifest. They are generated into
`src/lib/minecraft-version-manifest.ts`; run `pnpm mc:versions` after
Mojang ships a version and commit the result. Uploaders pick versions in
a searchable field: typing a line such as `1.20` offers to add all of its
releases at once, and snapshots stay hidden until "Show snapshots" is on.

Servers share that picker and also offer **Add Suggested**. It opens
`SuggestedVersionsModal`, which fetches the live release list from Mojang's
`version_manifest_v2.json` through `getSuggestedMinecraftVersions`. The
result is cached for an hour on the server and falls back to the generated
manifest when Mojang is unreachable. Releases appear as removable chips
alongside the versions already saved; typing a version and pressing Enter
or comma adds another chip. **Accept** writes the whole chip list back to
the form, while **Cancel** asks for confirmation before discarding the
edit. The same `ServerForm` is used when creating and when managing a
server, so the button is in both places.

## The creator dashboard

`/dashboard` is a guard plus an outlet; everything real lives in its
children:

* `/dashboard/projects`, the creator's projects
* `/dashboard/projects/new`, create a project
* `/dashboard/projects/$projectId?tab=`, `details`, `images`, `versions`,
  or `danger`
* `/dashboard/transfers`, the ownership-offer inbox

The project editor shares the Settings and Admin panel shell: a
`PageHeader` carrying the name, type, slug and status, a mobile section
drawer, and the `AppSidebar` mini-navigation beside the active panel. The
tab lives in `?tab=` and is parsed by `src/lib/project-tabs.ts`; switching
sections uses `navigate({ replace: true })` so section hops do not fill
browser history. A release project offers Details, Images, Versions and
Danger Zone; a server swaps Versions for Server. Reading columns keep a
`max-w-3xl` measure inside the wider `max-w-7xl` layout.

`FilledPill` (`src/components/filled-pill.tsx`) holds the status accent
shape. It was inline in the hero and the explore heading and is now used
by the dashboard as well, so there is one definition rather than three
copies.

The overview at `/dashboard/projects` is a management list rather than a
gallery. Each project is a divided row with its icon, name, status, type,
summary, category, release and download counts, and last update, followed
by explicit **Manage**, **View** or **Preview**, and **Delete** actions.
Above the rows, search, a type filter, status chips with counts, and a
sort control narrow the list. The empty state distinguishes "no projects
yet" from "no matches" and offers to clear the active filters.

`ProjectSummaryCard` (`src/components/dashboard/project-summary-card.tsx`)
renders one of those rows. It is no longer a whole-card link: a delete
action inside a link would navigate before the confirmation could open,
so the row leads with its content and ends with separate actions.
`listMyProjects` selects the icon row so the row can show it, falling back
to a type glyph when there is none.

`/dashboard/transfers` follows the notifications page's shape: one Card with a
CardHeader holding the pending count plus **Accept all** and **Deny all**, then
Incoming / Outgoing tabs, search and flat rows. Both bulk actions open an
AlertDialog first, because accepting several offers changes several owners.
They call the same per-transfer server function as a single row, so an expired
or stale offer is rejected on its own and the rest still go through.

Every Markdown surface in the creator dashboard uses `MarkdownEditor`
(`src/components/markdown-editor.tsx`): project descriptions, release
changelogs, and the profile bio. The editor and preview share one row from
`lg` up and stack in source order on smaller screens, so the preview is
always visible rather than hidden behind a toggle. The preview reuses
`MarkdownPreview` (`src/components/markdown-preview.tsx`), the same
component the blog post editor uses, so it always matches the published
output. The profile bio debounces its preview by 300 ms because that field
re-renders on every keystroke.

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

"Staff" means `moderator` or `admin`. Project access is expressed through
the `ROLE_RANK` ladder in `src/lib/roles.ts`, and the ownership checks in
`src/lib/project-access.ts` call `hasSessionRole(session, minimum)`  -
these are genuinely about rank, because "an owner or anyone above a plain
user" is the whole rule. The moderation decision endpoints instead use
`requireCapability("reviewProjects")` from `src/lib/role-guards.ts`, which
is the preferred form for new code: it names the job rather than
repeating the role. Both arrive at the same bar.

A moderator can reach a project they do not own because reviewing a
submission means reading it. See [Admin Panel](admin-panel.md#roles) for
the full matrix.

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

Every public read path already filters on `status = 'published'`, search,
the public project page, downloads, trending and the search document. A
project in `pending` therefore disappears from all of them with no change
to any of those queries, which is why adding the status was enough to make
review work.

There is deliberately no `rejected` status. A rejection returns the project
to `draft` and records why in `rejection_reason`, so the creator can fix it
and resubmit instead of being parked in a terminal state.

### When publishing skips the queue

Publishing is not always a queue. `needsReview`
(`src/lib/publication-rule.ts`) reads two stored timestamps and answers
in one expression, so the policy can be read and tested without a
database:

* **Never published** (`published_at` is null), queued. A first
  publication has been judged by nobody.
* **Published before, no takedown**, **goes straight back up.**
* **Taken down by staff at some point**, queued, whatever its history
  otherwise says.

A project the owner unpublished goes straight back up. Withdrawing your
own listing is not a moderation event, and making someone queue for
review to undo a decision they just made would put the review step in
charge of a self-service action.

A project **staff took down** queues regardless of its history, because
putting it back up is exactly what that judgement was for.

`published_at` is preserved when the owner unpublishes, which is what
makes "was live once" answerable at all. `taken_down_at` (added in
`0021`) is what the status cannot carry: a takedown sets
`status = 'removed'`, and by the time the project is live again that fact
has been overwritten by whatever came next.

`taken_down_at` is **cleared when staff approve**. An approval is a newer
and stronger judgement than the takedown it replaces; leaving the flag
set would make every later owner-initiated republish queue forever on the
strength of a decision staff have already overturned.

The publish button is labelled "Publish" rather than "Submit for review"
because it does not know which of the two will happen, and the toast
reports whichever did.

### Audit columns

* `submitted_at`, set when review is requested, cleared by any decision.
* `reviewed_at`, set by a decision, never cleared.
* `reviewed_by`, the deciding admin, never cleared.
* `rejection_reason`, set by a rejection, cleared on resubmission or
  approval.
* `taken_down_at`, set by a staff takedown, cleared by a staff
  approval, untouched by anything the owner does.

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
(`src/routes/api/projects/$projectId/versions/$versionId/files.ts`).
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

`GET /api/download/<fileId>` (`src/routes/api/download/$fileId.ts`)
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

The server stores the bytes it receives: no re-encoding, no crop. The
client may shrink an oversized image before sending it, via
`resizeImageForUpload`. The stored `width` and `height` let the UI reserve
the correct box and avoid layout shift.

A project with no uploaded icon gets a deterministic DiceBear identicon
instead of a letter tile. `projectFallbackIconUrl` builds
`https://api.dicebear.com/9.x/identicon/svg?seed=…` from the project's
`id`, and `ProjectImage` renders it in the same sized box an uploaded icon
would occupy. Everywhere a project appears  -  browse cards, trending, the
detail header and the creator list  -  keeps the same generated picture.

A project **icon** is different: selecting one opens `ImageCropModal`, the
same zoom, pan, pinch and slider control the account picture uses. The
creator frames a square, which is encoded as a 512px WebP and sent as the
icon. The circular scrim in the avatar version is only a preview; the icon
version outlines the square instead. Gallery images keep their own aspect
ratio and are uploaded directly, with no crop dialog.

## Server client requirements

Search derives each server's `clientRequirement` from its published links,
in SQL (`src/lib/search/projects.ts`) and in `clientRequirementFor`
(`src/lib/projects.ts`), which must agree: `required` when any link is
required, `recommended` when there are only optional links, and `vanilla`
when nothing is linked. The Servers page filters on it. Because it is
computed at query time, unpublishing a linked mod changes the server's
requirement right away.

A server's public page is its own component, and it shares the two-column
layout described under [Pages](#pages): a sidebar with the join address and
its copy button, the supported versions, and the client requirements, then
the description, gallery, and tags.

Client content is split into required and recommended rather than one flat
list, because the two are not the same kind of instruction: skipping a
required mod means the connection is refused, skipping a recommended one
costs fidelity. An unpublished link renders as plain text, since a link to
it would 404 for everyone but the server's owner.

## Search

Search reads these tables directly, so there is no index to sync after a
publish, edit, upload, or delete. See [Search](../search/postgres.md).

## Discovery

The home page loads from Postgres too, and all of it is refetched in the
background rather than on every render:

* **Trending**, the most active published projects, recomputed at most
  once a minute on the server and polled every 60 seconds
  (`TRENDING_REFRESH_MS` in `src/lib/trending.functions.ts`).
* **Explore**, the six category tiles from `src/lib/categories.ts`.
* **News**, the latest published blog posts, polled every five minutes
  (`POSTS_REFRESH_MS`).

## Demo data

`pnpm db:seed` runs both seeders against the first admin in the database:

* `pnpm db:seed:projects`, demo projects of every type, each with one
  version and a small generated archive uploaded to storage. Demo servers
  get join details, and two of them link to demo content, one required and
  one with three optional links.
* `pnpm db:seed:posts`, published demo blog posts, so the blog and the
  home page news section are not empty. Re-running leaves existing posts
  alone.

`pnpm db:seed:admin` promotes an existing account to `admin`, which is
required first: both seeders attach their content to the first admin.

## Related

* [Reports](reports.md), reporting a project or an account
* [Object Storage](../storage/object-storage.md)
* [Search](../search/postgres.md)
* [Discovery](discovery.md), how trending picks the home page five
* [Motion](motion.md), the reveal animation on listing grids
* [Accounts](../authentication/accounts.md)
* [Architecture Overview](../architecture/overview.md)
* [API Server](../architecture/api.md)

## Server voting

Servers support voting, rolling leaderboards, and optional Votifier rewards.
See [Server voting](server-voting.md) for player flows, cooldowns and deployment.

Published projects and servers also carry player ratings with optional short
notes. See [Player reviews](reviews.md) for the download gate and the rating
format.
