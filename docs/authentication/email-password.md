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

The sign-up page (`src/routes/signup.tsx`) validates input with
`validateSignupInput` from `src/lib/auth-validation.ts`, then calls:

```ts
await authClient.signUp.email({
  name,
  email,
  password,
});
```

On success the user is redirected to `/`.

## Sign in

The login page (`src/routes/login.tsx`) validates input, then calls:

```ts
await authClient.signIn.email({
  email,
  password,
});
```

On success the user is redirected to `/`.

## Validation rules

Shared validation lives in `src/lib/auth-validation.ts` and is used by
both the client forms and the server functions. It enforces:

* A valid email address
* A password of at least 8 characters
* A non-empty name on sign-up

## Password reset

Password reset is not wired up yet. To add it, enable the Better Auth
email verification flow and configure an email provider, then add a
"Forgot password" link to the login page.

## Related

* [Passkeys](passkeys.md)
* [Sessions](sessions.md)
* [Google Social Provider](../social-providers/google.md)
