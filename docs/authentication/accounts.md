# Accounts

How usernames, sign-in methods, and account deletion work. The rules
live in `src/lib/usernames.ts` (shared with the forms) and
`src/lib/account-lifecycle.ts` (database side); the server functions
are in `src/lib/account.functions.ts` and
`src/lib/admin-accounts.functions.ts`.

## Settings tabs

`/settings?tab=` selects one of four tabs, all driven by the URL so they
can be linked to:

| Tab        | Contents                                                |
| ---------- | ------------------------------------------------------- |
| `profile`  | Display name, Markdown bio, avatar, username            |
| `security` | Sign-in methods (password, Google, GitHub) and passkeys |
| `sessions` | Active sessions, revoke one or all others               |
| `danger`   | Password change and the account-deletion wizard         |

`?tab=passkeys` is a legacy alias that resolves to `security`, and
`?confirm=delete` resumes the deletion wizard after a re-authentication
round trip through the passkey or OAuth flow.

## Usernames

Every account has a username. It is shown on projects and can be used
to sign in instead of the email address.

* **Email sign-up** — the user picks it on the sign-up form. The
  sign-up page is at `/signup`.
* **Google or GitHub sign-up** — a free username is generated from the
  GitHub login, the email address, or the name, and
  `usernameConfirmed` is false. The user is sent to `/welcome` to keep
  or change it, and the dashboard redirects there until they do. This
  first choice does not start a cooldown.

Rules:

* 3–30 characters: letters, numbers, `_`, and `.`. Stored in lowercase;
  the typed capitalisation is kept as `displayUsername`.
* Reserved names (route names, `admin`, `voxelvein`, and similar) cannot
  be taken. The list of 33 is in `src/lib/usernames.ts`.
* After a change in **Settings → Profile** the username is locked for
  14 days.
* The old username stays reserved for its previous owner for 14 days
  (`username_history`) and still signs them in. Afterwards anyone can
  take it. Changing only the capitalisation is free.
* Better Auth's `updateUser` rejects `username` and `displayUsername`,
  so the cooldown cannot be bypassed.
* `/welcome` accepts only a `redirect` that starts with a single `/`, so
  a crafted link cannot bounce a new account off-site after it confirms
  its username (`src/lib/safe-redirect.ts`).

The sign-in field accepts an email address **or** a username. Because
Better Auth exposes those as separate calls, the login page branches on
the shape of the input client-side
(`src/routes/login.tsx`).

## Sign-in methods

**Settings → Security** lists the password, Google, and GitHub, and shows
passkeys directly below. Which providers appear is decided at runtime:
a provider is listed only when its credentials are set
(`src/components/settings/sign-in-providers.ts`).

* Link Google or GitHub to a signed-in account. The linked account's
  email may differ from the VoxelVein email.
* Accounts without a password (created through Google or GitHub) can set
  one.
* The last remaining sign-in method cannot be removed.

A user with a generated username can also set one for the first time from
**Settings → Profile**, which is the same card `/welcome` uses.

## Account deletion

**Settings → Danger Zone → Delete account** asks the user to:

1. Choose what happens to each project they own: delete it with the
   account, or keep it without an owner (shown as "Deleted user").
   Projects an admin marked as **large** are always kept.
2. Confirm it's them: the password, or a fresh sign-in with a passkey,
   Google, or GitHub. The server only accepts a session created in the
   last 10 minutes, or a correct password.
3. Type their username.

What happens next depends on the account's history:

| Account                      | Result                          |
| ---------------------------- | ------------------------------- |
| Never owned a project        | Deleted immediately             |
| Owns or once owned a project | Scheduled; purged after 14 days |

A scheduled account is banned (`banReason = "pending-deletion"`) and
signed out everywhere. Projects chosen for deletion are hidden at once.
For each large project, admins get an entry in the **Notifications**
tab of the admin panel.

Within the 14 days, the user can contact support. An admin restores the
account from **Admin → Deletions**, which unbans it and brings the
hidden projects back. Unbanning from the Users tab does not cancel the
deletion.

The wizard keeps its state in `sessionStorage` under
`voxelvein:pending-account-deletion` so a page reload mid-flow does not
lose the user's place, and it moves focus to each new step heading.

The `accounts:purge` Nitro task runs hourly (configured in
`vite.config.ts`, task file `src/tasks/purge-accounts.ts`). It
permanently deletes accounts past the grace period, including the chosen
projects, their stored files, and search entries, and clears expired
username reservations.

Related docs: [Admin Panel](../content/admin-panel.md) for the Deletions
tab, [Projects and Files](../content/projects.md) for what a project
deletion does.

## Bios, avatars, and public profiles

Every account has an optional bio, edited in **Settings → Profile** and
shown on a public profile page at `/u/<username>`. The rules live in
`src/lib/bio.ts`; the lookup is `src/lib/user-profiles.ts`, wrapped by
`getPublicProfile` in `src/lib/user-profiles.functions.ts`.

### Avatars

Uploaded in **Settings → Profile** by `src/components/settings/avatar-card.tsx`,
which posts to `/api/users/me/avatar`. The bytes go through the same
sniffing, filename regeneration, and quota gate as a project image — see
[Hardening](../security/hardening.md).

Three decisions worth knowing:

`users.image` holds the **URL**, `/api/avatar/<id>`
: That is Better Auth's own avatar field, which the navbar, the account
  menu, and the public profile already read. Writing it there means an
  upload appears everywhere at once, and there is exactly one copy of the
  URL rather than one per component.

A separate `user_images` table, not a key on `users`
: Replacing an avatar has to delete the object it replaced, which needs
  the previous key captured *before* the row is overwritten. A single
  column cannot hold both. One row per account, enforced by a unique
  index.

`users.id` is `text`, so `user_images.user_id` is too
: Better Auth's key type. A foreign key cannot reference across types,
  and the avatar's own `id` stays a `uuid` because that one is ours.

The image is resized in the browser before it is sent, using the `icon`
kind — an avatar renders at 24-80px, the same range as a project icon —
so a phone photo is scaled rather than stored and never used.

* The bio is **Markdown**, rendered with `@tanstack/markdown/react` in the
  same `.markdown-body` container as a project description, so raw HTML and
  executable URLs are escaped by the parser's defaults.
* It is capped at 500 characters, enforced in the form and again on the
  server by Better Auth's `validator.input` for `bio`. A direct call to the
  update endpoint cannot store a longer one.
* Clearing the field stores `null` rather than an empty string, so "no bio"
  stays distinct from a bio that renders as nothing. Whitespace-only is
  treated as no bio.
* `bio` is the one user field Better Auth accepts as input
  (`input` is not `false`), so it is saved through
  `authClient.updateUser` alongside the display name.

### The profile URL is keyed on `username`, not `displayUsername`

The URL uses `users.username`, which is unique and stored lowercase.
`users.displayUsername` has no unique constraint and differs only in
capitalisation, so it cannot identify a profile. The page heading shows
`displayUsername`, so `/u/ada` can be titled "Ada".

The requested name is normalised before lookup, so `/u/Ada` and `/u/ada`
are the same profile.

**Changing your username breaks links to your old profile.** A permanent
redirect is not possible: `username_history` rows are deleted once their
reservation expires, so the old name is only recoverable for 14 days. A
redirect would work briefly and then quietly stop, which is worse than a
consistent 404. An unknown name, an account with no username, and an
account that has requested deletion all resolve to a real 404 rather than
a "not found" page served with a 200, because this URL is linked from
every project byline.

### What a profile shows

Only `published` projects that are not marked for deletion. Drafts,
projects awaiting review, and removed projects are absent, and a user with
no published projects still gets a page with an empty grid.

An account that has requested deletion resolves to null, so the bio and
display name do not outlive the request. The `by` byline on a project links
to the author's profile, except when the owner is gone — then
`authorUsername` is null and the name stays plain text rather than linking
to a page that 404s.

## Large projects

Admins mark a project as large on its page (`projects.is_protected`,
labelled "Mark as large project"). Large projects are never deleted with
their owner's account, and owners cannot choose to delete them that way.

## Roles

There are three roles: `user`, `moderator`, and `admin`. Two files
define them, and both must change together. `src/lib/roles.ts` holds the
`ROLE_RANK` ladder, the labels, and the `hasRole` check;
`src/lib/permissions.ts` holds Better Auth's access-control statements and
a `assertRolesInSync` guard that fails startup if the two ever disagree.

`admin` has implicit access to every project operation. `moderator`
reviews projects and drafts, and can disable an account, but
deliberately **cannot** delete users, change roles, revoke sessions, or
publish a post. Those statements are absent from its role object rather
than checked in app code, so Better Auth refuses the matching `/admin/*`
endpoints even if a route guard is ever missed.

`hasRole` fails closed on an unrecognised role string, so a bad value
grants nothing. Adding a fourth role means editing both files; see
[Admin Panel](../content/admin-panel.md).

## Related

* [Sessions](sessions.md)
* [Passkeys](passkeys.md)
* [Cloudflare Turnstile](turnstile.md)
* [Admin Panel](../content/admin-panel.md)
* [Projects](../content/projects.md)
