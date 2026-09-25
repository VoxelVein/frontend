# Google Social Provider

This guide explains how to enable Google Sign-In (login and
registration) for VoxelVein using Better Auth's built-in Google OAuth
provider.

## Prerequisites

* A Google Cloud project with the OAuth consent screen configured
* A Google OAuth 2.0 Client ID and Client Secret

## 1. Create Google OAuth credentials

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project or select an existing one.
3. Go to **APIs & Services** → **OAuth consent screen** and configure
   the app (External user type is fine for development).
4. Go to **APIs & Services** → **Credentials** → **Create
   credentials** → **OAuth client ID**.
5. Choose **Web application** as the application type.
6. Add an authorized redirect URI:
   `http://localhost:6001/api/auth/callback/google`
7. Copy the **Client ID** and **Client Secret**.

## 2. Add the environment variables

Add the credentials to `.env.local`:

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

The variables are optional: if either is missing, the Google provider is
disabled and the app still starts.

## 3. Configure the server

The provider is configured in `src/lib/auth.ts`. The credentials are
read from the environment and the provider is only registered when both
values are present:

```ts
const googleProvider =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {};

export const auth = betterAuth({
  // ...
  socialProviders: googleProvider,
  // ...
});
```

No extra package is required — Google is built into Better Auth core.

## 4. Sign in from the client

The login and sign-up pages already render a **Continue with Google**
button (`src/components/google-sign-in-button.tsx`). It calls the
Better Auth client:

```ts
await authClient.signIn.social({
  provider: "google",
  callbackURL: "/",
});
```

The user is redirected to Google, then back to the callback URL with a
valid session. New users are registered automatically on first sign-in.

## 5. Verify

1. Start the dev server with `pnpm dev`.
2. Open `http://localhost:6001/login`.
3. Click **Continue with Google** and complete the flow.
4. You should land on `/` signed in.

## Troubleshooting

* **`redirect_uri_mismatch`** — the redirect URI in Google Cloud must
  match `BETTER_AUTH_URL` plus `/api/auth/callback/google`.
* **Provider not shown** — confirm both `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET` are set in `.env.local` and restart the dev
  server.
* **Production** — use the production origin in the redirect URI, for
  example `https://example.com/api/auth/callback/google`.

## Related

* [GitHub Social Provider](github.md)
* [Sessions](../authentication/sessions.md)
