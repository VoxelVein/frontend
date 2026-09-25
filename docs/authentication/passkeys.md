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

The passkey plugin must stay before `tanstackStartCookies()`, which has
to remain the last plugin.

## Client configuration

The client plugin is registered in `src/lib/auth-client.ts`:

```ts
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  plugins: [usernameClient(), passkeyClient()],
});
```

## Database

The `passkeys` table is defined in `src/db/schema.ts` and created by
the `drizzle/0002_quick_kylun.sql` migration. Run `pnpm db:generate`
and `pnpm db:migrate` after changing the schema (see
[Migrations](../database/migrations.md)).

## Settings UI

Users manage their passkeys on the **Passkeys** tab of the settings
page (`src/components/settings/settings-passkeys.tsx`). It supports:

* **Listing** — `authClient.useListPasskeys()` returns the user's
  passkeys with `data`, `isPending`, `error`, and `refetch`.
* **Adding** — `authClient.passkey.addPasskey({ name })` triggers the
  browser's WebAuthn registration prompt.
* **Removing** — the client does not expose a delete method, so the
  component calls the endpoint directly:

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

A sign-in button is not wired into the login page yet.

## Requirements

* WebAuthn requires a secure context: `https` or `localhost`.
* Passkeys are device-specific; users should add one per device they
  want to sign in from.

## Related

* [Email and Password](email-password.md)
* [Sessions](sessions.md)
* [Migrations](../database/migrations.md)
