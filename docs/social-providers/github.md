# GitHub Social Provider

This guide explains how to enable GitHub Sign-In (login and
registration) for VoxelVein using Better Auth's built-in GitHub OAuth
provider.

## Prerequisites

* A GitHub account
* A GitHub OAuth App with a Client ID and Client Secret

## 1. Create a GitHub OAuth App

1. Open **Settings** → **Developer settings** → **OAuth Apps** →
   **New OAuth App**.
2. Set the **Homepage URL** to `http://localhost:3000`.
3. Set the **Authorization callback URL** to
   `http://localhost:3000/api/auth/callback/github`.
4. Register the app and copy the **Client ID** and **Client Secret**.

## 2. Add the environment variables

Add the credentials to `.env.local`:

```bash
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
```

## 3. Configure the server

The provider is already wired in `src/lib/auth.ts` and is registered only
when both credentials are present:

```ts
if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
  Object.assign(socialProviders, {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      // Seeds the generated username (see `databaseHooks` below).
      mapProfileToUser: (profile: { login?: string }) => ({
        username: profile.login,
      }),
    },
  });
}
```

`GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are optional server
variables in `env.config.ts` and `.env.example`, and
`VITE_GITHUB_CLIENT_ID` is derived from `GITHUB_CLIENT_ID`.

`mapProfileToUser` puts the GitHub login in as the username hint. The
`databaseHooks.user.create.before` hook then picks the first free name
from that hint, the email local part, and the display name, so a taken or
invalid login falls back instead of failing the sign-up.

## 4. Sign in from the client

`src/components/github-sign-in-button.tsx` mirrors the Google button and
calls:

```ts
await authClient.signIn.social({
  provider: "github",
  callbackURL: "/",
  newUserCallbackURL: "/welcome",
});
```

New users are registered automatically on first sign-in and land on
`/welcome` to confirm their generated username. Like the Google button, it
renders nothing when `VITE_GITHUB_CLIENT_ID` is unset.

Linking an existing account to GitHub happens in **Settings → Security**,
not at sign-in. See [Accounts](../authentication/accounts.md).

## 5. Verify

1. Start the dev server with `pnpm dev`.
2. Open `http://localhost:3000/login`.
3. Click the GitHub button and complete the flow.
4. You should land on `/` signed in, or on `/welcome` for a new account.

## Troubleshooting

* **`redirect_uri_mismatch`** — the callback URL in the GitHub OAuth
  App must match `BETTER_AUTH_URL` plus `/api/auth/callback/github`.
* **Provider not shown** — confirm both `GITHUB_CLIENT_ID` and
  `GITHUB_CLIENT_SECRET` are set in `.env.local` and restart the dev
  server.
* **Name already taken** — the hook falls back to the email local part
  and then the display name, adding a numeric suffix if needed. Land on
  `/welcome` to pick something else.

## Related

* [Google Social Provider](google.md)
* [Accounts](../authentication/accounts.md)
* [Sessions](../authentication/sessions.md)
