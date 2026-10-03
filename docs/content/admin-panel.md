# Admin Panel

`/admin` is the whole back office: user management, account recovery,
blog posts, storage usage, the notification inbox, and the publishing
review queue. One panel, eight URL-driven tabs.

## Routes

TanStack Router nests by longest matching filename prefix, so the five
files under `src/routes/admin*.tsx` form two branches:

| Route                       | File                           |
| --------------------------- | ------------------------------ |
| `/admin`                    | `admin.index.tsx`              |
| `/admin` (layout)           | `admin.tsx`                    |
| `/admin/posts/*` (layout)   | `admin.posts.tsx`              |
| `/admin/posts/new`          | `admin.posts.new.tsx`          |
| `/admin/posts/$postId/edit` | `admin.posts.$postId.edit.tsx` |

The panel is the **index** route; the two `*.tsx` files above it are plain
layouts whose only job is a `beforeLoad` guard, and the two editor pages
render the editor. That split is not cosmetic. When a parent route with
children renders its own content instead of an `Outlet`, the child never
mounts — navigating to it swaps the URL and runs its loader, but the
parent keeps painting. The panel used to live in `admin.tsx` and decide at
render time whether to show tabs or defer to a child, so a disagreement
between that check and the router silently rendered nothing, taking the
whole panel with it. A layout cannot fail that way, so the panel moved to
`admin.index.tsx` and `admin.tsx` became `component: Outlet`.

The post editor gets the same treatment for the same reason. It also gets
its own guard, so `/admin/posts/new` and `/admin/posts/$postId/edit`
inherit the check by construction rather than each repeating it, and
`/admin/posts/$postId/edit` fetches its post in the loader so the form is
populated on first paint.

## Access

`beforeLoad` on `admin.tsx` calls `requireAdmin()`
(`src/lib/auth.functions.ts`), which returns `null` for anyone without the
`viewAdminPanel` capability and redirects to `/login`. It hands the
resolved session back as route context, so the panel reads the role from
`useRouteContext({ from: "/admin" })`.

That source matters. The panel previously read the role from
`authClient.useSession()`, which resolves *after* first paint — so during
SSR the role was `user`, no tab was visible, and the panel rendered with no
tab strip at all. The context is already resolved, so reading it is free on
the server and correct on the first paint.

The tab comes from `?tab=`, validated with a Valibot `picklist`,
defaulting to `users`:

```text
/admin?tab=users|sessions|posts|storage|notifications|deletions|reviews|reports
```

Better Auth's admin plugin provides the underlying primitives
(`listUsers`, `setRole`, `banUser`, `listUserSessions`,
`revokeUserSession`, impersonation, and the access-control statements in
`src/lib/permissions.ts`). The panels above it are ours.

## Roles

There are three roles, `user`, `moderator`, and `admin`, ordered by
`ROLE_RANK` (`src/lib/roles.ts`) — but almost nothing checks rank
directly. Authorization is expressed as **capabilities**, and each one
declares its own minimum in one table:

```ts
CAPABILITY_MINIMUM = {
  manageDeletions: "admin",
  manageNotifications: "admin",
  managePosts: "admin",
  manageProtectedProjects: "admin",
  manageSessions: "admin",
  manageStorage: "admin",
  manageUsers: "admin",
  publishPosts: "admin",
  reviewProjects: "moderator",
  viewAdminPanel: "moderator",
}
```

A call site asks `can(role, "manageUsers")`, never `role === "admin"`. A
role string at a check site says *who* is trusted but not *why*, and
spread across eighteen files the answer drifts; naming the job instead
makes each site self-documenting and puts every minimum in one place.
`satisfies Record<string, MinimumRole>` makes a minimum naming a role the
ladder lacks a compile error rather than a grant to nobody.

### What each role actually gets

**`user`** (rank 0)
: Own projects only. No capabilities, no panel.

**`moderator`** (rank 1)
: `reviewProjects`, `manageReports`, and `viewAdminPanel`, and
  **nothing else**.

**`admin`** (rank 2)
: All twelve capabilities.

A moderator's reach is deliberately narrow: they open the panel and work
the two moderation queues — Reviews and Reports. Account and session
handling is admin-only, so a moderator cannot list, ban, or delete an
account — **including an admin's**. They also cannot read or write blog
posts; `managePosts` is admin-only.

`manageReports` is deliberately its own capability rather than a fold-in
to `manageUsers`. Resolving a report is triage; banning the account it
concerns is a far heavier action that only an admin can take, and
grouping the two would let a moderator reach the second by accident.

If you are working from an older guide that gave moderators the account
and post controls, that changed when the role was narrowed to these two
capabilities. Check `CAPABILITY_MINIMUM` rather than any table you
remember.

`publishPosts` is split from `managePosts` even though both are admin-only
today. Publishing makes a post public, which is a different decision from
writing one; keeping them separate means the day drafting is opened up,
publishing does not follow by accident.

### Three layers, not one

The same policy is stated three times on purpose, and each layer catches
what the others miss:

1. **Capabilities** (`src/lib/roles.ts`) — what a role may do. Pure, with
   no server imports, so client components can import `can` without
   dragging the database into the browser bundle.
2. **Server guards** (`src/lib/role-guards.ts`) — `requireCapability`,
   the guard a new staff endpoint should reach for. It reads its minimum
   from `CAPABILITY_MINIMUM`, so the endpoint names the job it protects
   rather than repeating `"admin"`. `requireRole`, `requireStaff`, and
   `getRoleSession` remain for checks that are genuinely about a rank.
3. **Better Auth statements** (`src/lib/permissions.ts`) — what the plugin
   enforces on `/admin/*`.

The panel is **not** the security boundary. It hides tabs a role cannot
use, rather than rendering them and refusing, and the server functions
behind each tab enforce the same bar independently.

### Keeping the layers from drifting

`CAPABILITY_MINIMUM` and the Better Auth statements are two independent
expressions of one policy, and a drift between them fails **open** — the
panel hides tabs, so a stray `user: ["ban"]` on `moderator` hands back a
power no UI shows and nothing else notices.

Two startup assertions close that gap, both in `src/lib/permissions.ts`:

* `assertRolesInSync()` throws if the ladder names a role the plugin does
  not know about. A role wired into only one of the two places otherwise
  fails closed and reads as a permission bug rather than a
  configuration mistake.
* `assertCapabilitiesAgree()` throws if a role holds statements for a
  capability it does not have, and `statementsFor` throws if a
  statement-bearing capability maps to no Better Auth resource. A grant
  that looks plugin-enforced but is not is the exact drift worth failing
  on.

The statements are held as data (`ROLE_STATEMENTS`, grouped by the
capability that grants them) rather than written inline into
`ac.newRole`, because `newRole` returns an opaque object: statements
passed straight to it cannot be read back, so an inline table could not be
checked against the ladder. That way the table that *grants* is the table
that is *verified*.

* **`admin`** — `user`: ban, create, delete, get, list, set-email,
  set-password, set-role, update. `session`: delete, list, revoke.
* **`moderator`** — nothing.
* **`user`** — nothing.

Moderator holds nothing, which is what makes the panel's claim above
enforceable rather than decorative: Better Auth refuses the endpoints, so
even if a route guard were missed, the capability is still absent.

`mod` and `report` used to be declared here. Nothing read them — no
`/admin/*` endpoint names either resource and no `hasPermission` call
exists outside that file. They were documentation that looked like
enforcement, so they were removed and their policy is now enforced where
it actually runs, as `requireCapability` guards.

`adminRoles` is left at its default, so only `admin` satisfies the
plugin's own admin checks. A moderator's reach comes from their
capabilities.

### Acting on another account

`canActOn(callerRole, targetRole)` in `src/lib/roles.ts` answers "may I
act on this account?" by seniority: you may act on anyone you are at
least as senior as. An admin therefore reaches every account *including
another admin's* — two admins need to be able to clean up a compromised
peer, and only a handful of people hold the role — while a moderator can
never touch an admin.

This is a **UI** predicate, not an authorization check. It decides which
buttons are inert and is always paired with `can(role, "manageUsers")`.
Do not use it to guard a server function: it compares ranks only, so it
cannot know whether the caller holds the capability, and it deliberately
permits admin-on-admin because Better Auth has no notion of outranking a
target. A target whose role is unrecognised outranks everyone, so it fails
closed the same way `hasRole` does.

## Tabs

Each tab declares the capability it needs in `TAB_CAPABILITY`
(`src/lib/admin-tabs.ts`). A tab a staff member cannot use is not
rendered, and a bookmarked URL for a tab they cannot see falls back to
the first one they can.

`resolveAdminTab` is total: it returns a real tab even for a role that
can see none. That is not defensive padding. The panel used to index
`visibleTabs[0]` for the fallback, and a moderator whose tabs were
Reviews alone — or a session that has not resolved yet and therefore
reads as `user` — made that `undefined.value` and crashed the panel.
The policy is extracted to its own module so it can be tested without
rendering it.

The Notifications, Reviews, and Reports tabs carry unread, pending, and
open counts. All are fetched client-side after mount and fail soft to
`null`, because a badge must never be the reason the page fails to render
— the tab itself is where the real error is reported. A failed count
therefore renders as `0` until the panel loads. Only the badges a staff
member's role can see are fetched, since the others would 403.

### Users

A database-side search over accounts, with role, ban state, and join date.
Actions:

* Change a role between `user`, `moderator`, and `admin`
* Ban or unban, optionally with an expiry
* Remove an account

A row's controls go inert for two independent reasons, and each states its
reason in text rather than leaving a dead button unexplained: the row is
your own account, or `canActOn` says the target's role is above yours.
Since `manageUsers` is admin-only, a moderator never reaches this tab at
all — in practice the outranking case is an admin viewing another admin.

The search is **not** a paginated list. An earlier version called
`listUsers({ limit: 100 })` once and virtualized the result, which made
every account past that row permanently unreachable — there was no way to
look them up at all. The field now debounces 300 ms and queries with
`searchValue` / `searchOperator: "contains"` against `name`, capped at 50
rows. An empty term lists the most recent accounts.

The role filter chips (all / user / moderator / admin) narrow the fetched
page client-side rather than re-querying, since a second round trip per
chip would be slower for no extra reach. The header count therefore
describes the rows on screen, and says so.

Fifty rows render without a virtualizer, so the list is a plain `grid` —
which also removes the `measureElement` plumbing and the row-height
estimate it existed to correct. The sessions list below still virtualizes,
because one user can have many sessions.

Each destructive action goes through a `ConfirmDialog`.

### Sessions

Search for a user, then review their active sessions: a device icon
derived from the user agent (desktop or mobile), the IP, when the session
started, and when it expires. Timestamps are relative phrases from
`relativeTime` (`src/lib/relative-time.ts`), shared with the notifications
inbox so the two cannot keep separate copies of the same thresholds.

`Revoke all` appears once a user has more than one session; individual
sessions can be revoked from their row. Sessions are virtualized, since
one account can hold many.

User search works the same way as the Users tab: debounced, queried in the
database, capped at 50. The account list is *not* client-side filtered
over a fixed page.

### Posts

The blog back office, admin-only. See [Blog](blog.md) for the editor and
the drafting/publishing rules.

### Storage

Total stored bytes against `STORAGE_QUOTA_BYTES`, as a `<progress>` bar.
Above 90% it shows a warning. With no quota configured it says so rather
than showing an empty bar.

### Notifications

The admin inbox, newest first, with the same shared `relativeTime`
timestamps. Notifications are created for review decisions and for account
deletions that involve a project an admin marked as large. One notification
can be marked read, or all of them at once.

### Deletions

Accounts inside their 14-day deletion grace period, with the date the
request was made. Restoring one unbans it and brings its hidden projects
back. Unbanning from the Users tab does **not** cancel a pending deletion;
this tab is the only place that does.

### Reviews

The publishing review queue, oldest submission first (up to
`REVIEW_LIMIT`, 200). Each entry shows the project, its type, the owner,
and when it was submitted. Approving publishes it; sending it back moves it
to draft with a required reason of at most 2000 characters. Both decisions
notify the creator.

## Layout and feedback

`PageHeader` with a title and description, then a wrapping `Tabs` list
labelled "Admin sections". Each tab renders one component from
`src/components/admin/`. Every tab follows the same three-state pattern:
skeleton while loading, `EmptyState` with the right copy when there is
nothing, and `ErrorState` with a retry on failure.

**Action feedback goes to Sonner; validation and load errors stay
inline.** The split is deliberate rather than a matter of taste:

* A save, ban, role change, or delete is *action* feedback. It reports on
  something the admin did, it has no field to sit beside, and a toast does
  not move focus or interrupt a screen reader mid-sentence. Failures carry
  a **Try again** action that repeats the request that failed — not
  whatever the search field holds when the button is clicked, which was a
  real bug in the users tab.
* Field-level validation stays inline because the message must be next to
  the field and associated with it via `aria-describedby`.
* A retryable *load* failure stays inline for the same reason: the retry
  control has to be visible where the content failed, not in a corner
  that has already scrolled away.

This replaced a shared `FormError` component that every form mounted
above its fields.

## Related

* [Reports](reports.md) — the Reports tab and what it
  queues

* [Projects and Files](projects.md)
* [Blog](blog.md)
* [Accounts](../authentication/accounts.md)
* [Object Storage](../storage/object-storage.md)
* [Hardening](../security/hardening.md) — headers, CSRF, and upload gates
