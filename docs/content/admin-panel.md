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

The Notifications and Reviews tabs carry unread and pending counts. Both
are fetched client-side after mount and fail soft to `null`, because a
badge must never be the reason the page fails to render — the tab itself
is where the real error is reported. A failed count therefore renders as
`0` until the panel loads.

## Tabs

### Users

A virtualized table (`@tanstack/react-virtual`) of every account, with
role, ban state, and creation date. Actions:

* Change a role between `user` and `admin`
* Ban or unban, optionally with an expiry
* Delete an account

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
