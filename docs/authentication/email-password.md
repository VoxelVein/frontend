# Email and Password Authentication

VoxelVein uses Better Auth for email/password sign-up and sign-in. This
guide explains how the flow is configured and how to adjust it.

## Configuration

Email/password auth is enabled in `src/lib/auth.ts`:

```ts
emailAndPassword: {
  enabled: true,
  requireEmailVerification: false,
},
```

* `enabled` — turns the email/password endpoints on.
* `requireEmailVerification` — when `true`, users must verify their
  email before a session is created. Verification emails are not
  configured yet, so keep this `false` until an email provider is
  added.

## Sign up

The sign-up page (`src/routes/signup.tsx`) validates each field with
`validateSignupInput` from `src/lib/auth-validation.ts` through a
TanStack Form field, then calls:

```ts
await authClient.signUp.email({
  name,
  email,
  password,
  fetchOptions: turnstileFetchOptions(token),
});
```

On success the user is redirected to `/`. Both the Google and GitHub
buttons render above the form, and each returns `null` when its
`VITE_*_CLIENT_ID` is unset, so an unconfigured provider leaves no dead
button behind.

## Sign in

The login page (`src/routes/login.tsx`) accepts an **email address or a
username** in a single field and branches on which one it looks like,
because Better Auth exposes `signIn.email` and `signIn.username` as
separate calls:

```ts
await authClient.signIn.email({ email, password });
// or
await authClient.signIn.username({ username, password });
```

The field is deliberately not `type="email"` and uses
`autoComplete="username"`, the token that pairs with a password field.
Both branches report the same message on failure — "Invalid email,
username, or password" — so the response does not reveal whether an
account exists.

Both `/login` and `/signup` redirect to `/` when a session already
exists, so signing in from a bookmarked link does not dead-end.

## Turnstile

Both flows are gated by Cloudflare Turnstile. The widget renders only when
`VITE_TURNSTILE_SITE_KEY` is set, and the token travels in the
`cf-turnstile-response` header. See [Cloudflare Turnstile](turnstile.md).

## Validation rules

Shared validation lives in `src/lib/auth-validation.ts` and is used by
both the client forms and the server functions. It enforces:

* A valid email address (`EMAIL_PATTERN` in `auth-validation.ts`)
* A password of at least 8 characters (`MIN_PASSWORD_LENGTH`)
* A non-empty name on sign-up

Sign-in also accepts a username of 3–30 characters matching
`USERNAME_PATTERN`. Better Auth's username plugin enforces the same bounds
and the reserved-name list on the server.

## Passwords for social-only accounts

An account created through Google or GitHub has no password.
**Settings → Security** can add one (`setPassword` in
`src/lib/account.functions.ts`, which calls Better Auth's server-only
`setPassword` endpoint), and **Settings → Danger Zone** changes an
existing one.

## Password reset

Password reset is not wired up yet, and neither is email verification —
which is why a password account cannot become a verified uploader. To add
either, configure an email provider, enable the corresponding Better Auth
flow, and add a "Forgot password" link to the login page. See
[Projects and Files](../content/projects.md) for why that blocks
uploading today.

## Related

* [Passkeys](passkeys.md)
* [Sessions](sessions.md)
* [Cloudflare Turnstile](turnstile.md)
* [Accounts](accounts.md)
* [Google Social Provider](../social-providers/google.md)
