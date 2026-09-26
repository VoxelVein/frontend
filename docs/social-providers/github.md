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

Add the provider to `src/lib/auth.ts`. Like Google, the provider is
only registered when both credentials are present:

```ts
const githubProvider =
  env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
        },
      }
    : {};

export const auth = betterAuth({
  // ...
  socialProviders: {
    ...googleProvider,
    ...githubProvider,
  },
  // ...
});
```

Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to `env.config.ts`
and `.env.example` as optional server variables, matching the Google
pattern.

## 4. Sign in from the client

Create a button component that mirrors
`src/components/google-sign-in-button.tsx` and call:

```ts
await authClient.signIn.social({
  provider: "github",
  callbackURL: "/",
});
```

New users are registered automatically on first sign-in.

## 5. Verify

1. Start the dev server with `pnpm dev`.
2. Open `http://localhost:3000/login`.
3. Click the GitHub button and complete the flow.
4. You should land on `/` signed in.

## Troubleshooting

* **`redirect_uri_mismatch`** — the callback URL in the GitHub OAuth
  App must match `BETTER_AUTH_URL` plus `/api/auth/callback/github`.
* **Provider not shown** — confirm both `GITHUB_CLIENT_ID` and
  `GITHUB_CLIENT_SECRET` are set in `.env.local` and restart the dev
  server.

## Related

* [Google Social Provider](google.md)
* [Sessions](../authentication/sessions.md)
