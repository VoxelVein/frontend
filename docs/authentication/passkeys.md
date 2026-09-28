# Passkeys

Passkeys let users sign in without a password using platform
authentication (fingerprint, face, or device PIN). VoxelVein uses the
Better Auth passkey plugin.

## Server configuration

The plugin is configured in `src/lib/auth.ts`:

```ts
import { passkey } from "@better-auth/passkey";

const rpID = new URL(env.BETTER_AUTH_URL).hostname;

plugins: [
  username(),
  passkey({
    origin: env.BETTER_AUTH_URL,
    rpID,
    rpName: "VoxelVein",
  }),
  // MUST be the last plugin for TanStack Start cookie handling
  tanstackStartCookies(),
],
```

* `rpID` — the WebAuthn relying party ID. It is derived from the
  `BETTER_AUTH_URL` hostname, so it is `localhost` in development.
* `origin` — the allowed origin for WebAuthn requests.
* `rpName` — the name shown in the browser's passkey prompt.

The plugin order matters and is: `username()`, `accountRules`, `admin()`,
`passkey()`, then `tanstackStartCookies()`. The cookie plugin has to stay
last.

## Client configuration

The client plugin is registered in `src/lib/auth-client.ts`:

```ts
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    passkeyClient(),
    adminClient({ ac, roles: { admin, user } }),
  ],
});
```

## Database

The `passkeys` table is defined in `src/db/schema.ts` and created by the
`drizzle/0002_quick_kylun.sql` migration. There is no `lastUsedAt` column
yet. After changing the schema, generate and apply a migration — see
[Migrations](../database/migrations.md).

## Settings UI

Users manage their passkeys on the **Security** tab of the settings page,
below the sign-in methods
(`src/components/settings/settings-passkeys.tsx`,
`/settings?tab=security`). There is no separate Passkeys tab; older
`?tab=passkeys` links resolve to `security`.

It supports:

* **Listing** — a TanStack Query over the `listPasskeys` server function
  (`src/lib/auth.functions.ts`) with the `["passkeys"]` query key. The
  server function strips `publicKey`, `counter`, `transports`, and
  `aaguid` before returning, so no credential material reaches the
  client.
* **Adding** — `authClient.passkey.addPasskey({ name })` triggers the
  browser's WebAuthn registration prompt, then invalidates the query.
* **Removing** — the client does not expose a delete method, so the
  component calls the endpoint directly behind a `ConfirmDialog`:

```ts
await authClient.$fetch("/passkey/delete-passkey", {
  body: { id },
  method: "POST",
});
```

## Sign in with a passkey

Passkey sign-in is available through the Better Auth client:

```ts
await authClient.signIn.passkey();
```

A sign-in button is not wired into the login page yet. Passkeys are
currently a second factor for a signed-in account, and one of the ways to
re-authenticate during account deletion.

## Requirements

* WebAuthn requires a secure context: `https` or `localhost`.
* Passkeys are device-specific; users should add one per device they
  want to sign in from.
* Registering or removing a passkey requires a session younger than
  `freshAge` (one day), so the user may be asked to sign in again. See
  [Sessions](sessions.md).

## Related

* [Email and Password](email-password.md)
* [Sessions](sessions.md)
* [Accounts](accounts.md)
* [Migrations](../database/migrations.md)
