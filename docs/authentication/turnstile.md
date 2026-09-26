# Cloudflare Turnstile

Password sign-in (email and username) and email sign-up are protected by
[Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/).
Passkeys and Google/GitHub sign-in are not gated; they already resist
automated abuse.

## How it works

1. `TurnstileWidget` (`src/components/turnstile-widget.tsx`) renders the
   widget on the login and signup forms with the action `login` or
   `signup`, matching the site's light or dark theme.
2. The form sends the widget's token to Better Auth in the
   `cf-turnstile-response` request header.
3. A Better Auth `before` hook in `src/lib/auth.ts` calls
   `verifyTurnstileToken` (`src/lib/turnstile.ts`) for
   `/sign-in/email`, `/sign-in/username`, and `/sign-up/email`.
4. The request only proceeds when siteverify reports `success`, the
   expected action, and a hostname listed in `TURNSTILE_HOSTNAMES`.
   Anything else is rejected with `403`; a missing configuration or an
   unreachable siteverify fails closed with `503`.

Tokens are single-use, so the forms reset the widget after every failed
attempt.

## Configuration

| Variable                  | Where        | Description                       |
| ------------------------- | ------------ | --------------------------------- |
| `VITE_TURNSTILE_SITE_KEY` | Build/client | Widget site key (public)          |
| `TURNSTILE_SECRET`        | Server       | Widget secret key (private)       |
| `TURNSTILE_HOSTNAMES`     | Server       | Comma-separated allowed hostnames |

`VITE_TURNSTILE_SITE_KEY` is inlined at build time, so it must be set
when the app is built, not only at runtime.

For local development, `.env.example` ships Cloudflare's public
always-pass
[test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
with `TURNSTILE_HOSTNAMES=localhost,127.0.0.1`. Test keys only work
outside production.

In production (`NODE_ENV=production`) the server rejects password
sign-in and sign-up, and logs an error at startup, when:

* `TURNSTILE_SECRET` or `TURNSTILE_HOSTNAMES` is missing
* `TURNSTILE_SECRET` is a Cloudflare test secret
* `TURNSTILE_HOSTNAMES` contains `localhost` or `127.0.0.1`

## Adding Turnstile to another endpoint

1. Add an action name to `TurnstileAction` in `src/lib/turnstile.ts`.
2. Render `<TurnstileWidget action="…" />` in the form and keep the
   token in a ref.
3. Call `verifyTurnstileToken` in the server handler before the existing
   logic runs, and reset the widget after each failed attempt.

## Related

* [Email and Password](email-password.md)
* [Sessions](sessions.md)
