# Accounts

How usernames, sign-in methods, and account deletion work. The rules
live in `src/lib/usernames.ts` (shared with the forms) and
`src/lib/account-lifecycle.ts` (database side); the server functions
are in `src/lib/account.functions.ts` and
`src/lib/admin-accounts.functions.ts`.

## Usernames

Every account has a username. It is shown on projects and can be used
to sign in instead of the email address.

* **Email sign-up** — the user picks it on the sign-up form.
* **Google or GitHub sign-up** — a free username is generated from the
  GitHub login, the email address, or the name, and
  `usernameConfirmed` is false. The user is sent to `/welcome` to keep
  or change it, and the dashboard redirects there until they do. This
  first choice does not start a cooldown.

Rules:

* 3–30 characters: letters, numbers, `_`, and `.`. Stored in lowercase;
  the typed capitalisation is kept as `displayUsername`.
* Reserved names (route names, `admin`, `voxelvein`, and similar) cannot
  be taken. The list is in `src/lib/usernames.ts`.
* After a change in **Settings → Profile** the username is locked for
  14 days.
* The old username stays reserved for its previous owner for 14 days
  (`username_history`) and still signs them in. Afterwards anyone can
  take it. Changing only the capitalisation is free.
* Better Auth's `updateUser` rejects `username` and `displayUsername`,
  so the cooldown cannot be bypassed.

## Sign-in methods

**Settings → Security** lists the password, Google, and GitHub, and
links to passkeys.

* Link Google or GitHub to a signed-in account. The linked account's
  email may differ from the VoxelVein email.
* Accounts without a password (created through Google or GitHub) can set
  one.
* The last remaining sign-in method cannot be removed.

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

| Account                          | Result                                  |
| -------------------------------- | --------------------------------------- |
| Never owned a project            | Deleted immediately                     |
| Owns or once owned a project     | Scheduled; purged after 14 days         |

A scheduled account is banned (`banReason = "pending-deletion"`) and
signed out everywhere. Projects chosen for deletion are hidden at once.
For each large project, admins get an entry in the **Notifications**
tab of the admin panel.

Within the 14 days, the user can contact support. An admin restores the
account from **Admin → Deletions**, which unbans it and brings the
hidden projects back. Unbanning from the Users tab does not cancel the
deletion.

The `accounts:purge` Nitro task runs hourly (configured in
`vite.config.ts`). It permanently deletes accounts past the grace
period, including the chosen projects, their stored files, and search
entries, and clears expired username reservations.

## Large projects

Admins mark a project as large on its page. Large projects are never
deleted with their owner's account, and owners cannot choose to delete
them that way.

## Related

* [Sessions](sessions.md)
* [Passkeys](passkeys.md)
* [Projects](../content/projects.md)
