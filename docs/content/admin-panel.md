# Admin Panel

`/admin` is the whole back office: user management, account recovery,
blog posts, storage usage, the notification inbox, and the publishing
review queue. One route, seven URL-driven tabs.

## Access

`beforeLoad` calls `requireAdmin()` (`src/lib/auth.functions.ts`) and
redirects to `/login` when it returns `null`. The tab comes from
`?tab=`, validated with a Valibot `picklist`, defaulting to `users`:

```text
/admin?tab=users|deletions|notifications|posts|reviews|sessions|storage
```

Better Auth's admin plugin provides the underlying primitives
(`listUsers`, `setRole`, `banUser`, `listUserSessions`,
`revokeUserSession`, impersonation, and the access-control statements in
`src/lib/permissions.ts`). The panels above it are ours.

## Roles

There are three roles, ordered in `ROLE_RANK` (`src/lib/roles.ts`):

**`user`** (rank 0)
: Only their own projects. Nothing in the panel.

**`moderator`** (rank 1)
: Review submissions, draft blog posts, ban an account.

**`admin`** (rank 2)
: Everything, plus role changes, account deletion, sessions, and storage.

A role grants everything at or below its rank, so `admin` is a superset of
`moderator`. Every check calls `hasRole(role, minimum)` rather than
comparing role names, so a check cannot silently miss the new role.

`src/lib/roles.ts` holds only the pure ladder, with no server imports —
client components import `hasRole` to decide what to render, and pulling the
session helpers in would drag the database into the browser bundle. The
session-based guards (`getRoleSession`, `requireRole`, `requireStaff`) live
in `src/lib/role-guards.ts`.

The panel's minimum is `moderator`, and each tab declares its own minimum in
`TAB_MINIMUM_ROLE`. A tab a staff member cannot use is **not rendered**,
rather than rendered and refused, and a bookmarked URL for a tab they cannot
see falls back to the first one they can. The server functions behind each
tab enforce the same bar independently, so the tab table is presentation
and not the security boundary.

`src/lib/permissions.ts` expresses the same split in Better Auth's
statements, which is what actually gates the `/admin/*` endpoints. A
moderator holds `user: ["get", "list", "ban"]` and no `delete`, `set-role`,
`set-password`, or `set-email`, and no `session` statements at all — so even
if a guard in this app were missed, the plugin refuses the endpoint.

`adminRoles` is left at its default, so only `admin` satisfies the plugin's
own admin checks. A moderator's reach comes from their statements.

`assertRolesInSync()` runs at import and throws if the ladder names a role
the plugin does not know about. Without it, a role wired into only one of
the two places fails closed and reads as a permission bug rather than a
configuration mistake.

To grant a role outside the UI:

```bash
pnpm db:seed:admin you@example.com moderator
```

That is the only way to create the **first** admin, since `/admin` and
`setRole` both require a role the account does not have yet. See
[Bootstrapping the First Admin](../authentication/first-admin.md) for the
production and Dokploy walkthrough.

The Notifications and Reviews tabs carry unread and pending counts. Both
are fetched client-side after mount and fail soft to `null`, because a
badge must never be the reason the page fails to render — the tab itself
is where the real error is reported. A failed count therefore renders as
`0` until the panel loads. Only the badges a staff member's role can see are
fetched, since the others would 403.

## Tabs

### Users

A virtualized table (`@tanstack/react-virtual`) of every account, with
role, ban state, and creation date. Actions:

* Change a role between `user`, `moderator`, and `admin` (admin only)
* Ban or unban, optionally with an expiry
* Delete an account (admin only)

A moderator sees only the ban control. The role selector and the delete
button are not rendered for them, rather than shown and then refused.

Each destructive action goes through a `ConfirmDialog`, and failures are
surfaced as keyed toasts rather than inline text.

### Sessions

Pick a user, then see their active sessions in a virtualized list with a
device icon derived from the user agent (desktop or mobile) and the
session's IP. Individual sessions can be revoked.

### Posts

The blog back office. See [Blog](blog.md).

### Storage

Total stored bytes against `STORAGE_QUOTA_BYTES`, as a `<progress>` bar.
Above 90% it shows a warning. With no quota configured it says so rather
than showing an empty bar.

### Notifications

The admin inbox, newest first, with relative timestamps
(`Intl.RelativeTimeFormat`). Notifications are created for review
decisions and for account deletions that involve a project an admin marked
as large. One notification can be marked read, or all of them at once.

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

## Layout

`PageHeader` with a title and description, then a wrapping `Tabs` list
labelled "Admin sections". Each tab renders one component from
`src/components/admin/`. Every tab follows the same three-state pattern:
skeleton while loading, `EmptyState` with the right copy when there is
nothing, and `ErrorState` with a retry on failure.

## Related

* [Projects and Files](projects.md)
* [Blog](blog.md)
* [Accounts](../authentication/accounts.md)
* [Object Storage](../storage/object-storage.md)
* [Hardening](../security/hardening.md) — headers, CSRF, and upload gates
