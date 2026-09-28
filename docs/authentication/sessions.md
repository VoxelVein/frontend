# Sessions

Sessions are managed by Better Auth and stored in the `sessions` table.
This guide explains the session settings in `src/lib/auth.ts`.

## Configuration

```ts
session: {
  // 30 days
  expiresIn: SESSION_EXPIRES_IN_SECONDS,
  // sensitive actions need a session created within the last day
  freshAge: ONE_DAY_IN_SECONDS,
  // extend the expiry at most once per day
  updateAge: ONE_DAY_IN_SECONDS,
},
```

* `expiresIn` — how long a session lives, in seconds. The default is
  30 days.
* `updateAge` — how often the session expiry is refreshed, in seconds.
  An active user's session keeps sliding forward, but the database is
  written at most once per day instead of on every request.
* `freshAge` — how recently the session must have been created for
  sensitive actions. Listing sessions, registering a passkey, and
  unlinking a social account require a session younger than one day;
  otherwise the user has to sign in again. Deleting the account is
  stricter — a session created in the last 10 minutes, or a correct
  password. See [Accounts](accounts.md).

## How sessions work

1. On sign-in, Better Auth creates a session cookie and a row in the
   `sessions` table.
2. On each request, the session is validated, and once per `updateAge`
   its expiry is pushed forward.
3. When the session expires, the user must sign in again.

The cookie handling for TanStack Start comes from the
`tanstackStartCookies()` plugin, which must remain the last plugin in the
array. See [Passkeys](passkeys.md).

## Sign out

Sign out is handled by the Better Auth client:

```ts
await authClient.signOut();
```

The session row is deleted and the cookie is cleared. **Settings** falls
back to a hard `window.location.assign("/")` when the client-side call
fails, so a stale client store cannot leave a signed-out-looking page
behind a live cookie.

## Session management UI

The **Sessions** tab of the settings page (`/settings?tab=sessions`,
`src/components/settings/settings-sessions.tsx`) lists active sessions
and lets the user revoke one, or revoke every other session. The current
session is highlighted so "revoke others" is unambiguous.

Admins can list and revoke any user's sessions from
**Admin → Sessions**. See [Admin Panel](../content/admin-panel.md).

## Related

* [Email and Password](email-password.md)
* [Passkeys](passkeys.md)
* [Accounts](accounts.md)
* [Google Social Provider](../social-providers/google.md)
