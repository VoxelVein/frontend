# Server voting

Players vote from a server card, its detail page, or Top Voted Servers on the
homepage and server browse page. Sign in, verify your email, select Java or
Bedrock, enter your exact Minecraft name, complete Turnstile, and confirm.
A successful vote updates the total immediately; other browsers poll every
30 seconds. The dialog reports rejected votes without closing.

## Cooldown

A vote starts a rolling 24-hour cooldown when its database transaction accepts
it. The same account, case-insensitive Minecraft name within its edition, or
trusted client IP cannot vote for that server again until exactly 24 hours
have elapsed. There is no midnight reset. Other servers have independent
cooldowns. A shared public IP shares a cooldown. A new name or account does
not bypass an existing IP cooldown. Failed validation and bot checks do not
consume a vote. A reward delivery failure still counts as a successful vote
and starts the cooldown. The server clock is authoritative; the displayed
countdown is advisory, and a rejected submission reports the next eligible time.

Daily, weekly and monthly rankings use rolling windows of 24 hours, 7 days and
30 days, respectively. All-time includes all recorded votes. Ties sort by
server name and then ID. Only published, available servers with voting enabled
appear. Most voted sorting in the project browser uses all-time totals.

## Owner setup

Open Dashboard → Projects → your server → Server and find Server voting.
Enable voting and save. Rewards are optional: leave the host empty to count
votes without sending Minecraft notifications. For rewards, enter a public
Votifier listener hostname and port, choose v1 or v2, and save the RSA public
key or NuVotifier token. Blank tokens retain an existing token. Clearing the
host disables delivery. Test with an explicit player name after saving.
**The test sends a real reward notification**, but adds no website vote and
starts no cooldown. Recent history shows the last 50 votes and their delivery
outcomes; statistics refresh every 30 seconds.

Bedrock names may include spaces, periods and a Floodgate prefix. Enter the
exact name expected by the receiving reward plugin. Votifier itself has no
edition field or Minecraft account ownership proof; the receiver must support
Bedrock/Floodgate and resolve the provided name. Website votes do not prove
ownership of the Minecraft account.

## Deployment

Apply `pnpm db:migrate` before starting the new application version. Migration
`0029_server_voting` creates history and settings and adds the total counter.
Set `VOTING_ENCRYPTION_KEY` to a base64 encoded random 32-byte key, for example
with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
Keep this key stable, back it up separately from the database, and provide it
to every application instance. Tokens are AES-256-GCM encrypted at rest and
never returned to the browser. Key rotation requires re-entering tokens.

Production voting fails closed unless `TURNSTILE_SECRET`,
`TURNSTILE_HOSTNAMES`, and `VITE_TURNSTILE_SITE_KEY` are configured. Configure
Turnstile for action `vote`. Development can omit Turnstile. Use the existing
shared Valkey rate limiting in production. Set `TRUST_PROXY=true` only behind
a proxy that appends the genuine client IP to X-Forwarded-For; otherwise IP
limits and IP cooldowns are unavailable. Account and player cooldowns still
apply. Outbound TCP and DNS are required; deploy on a Node runtime with TCP
support. Votifier destinations are resolved and pinned to public addresses;
private networks, loopback, metadata endpoints and reserved ranges are blocked.

Project row locks serialize cooldown checks and counter increments across
application instances. Vote history is append-only during voting. Account
deletion removes the account reference while preserving vote history and totals.
Do not delete vote history manually if rolling statistics are
required.

## Reward delivery semantics

NuVotifier v2 signs the server challenge on the same TCP connection and waits
for an acknowledgement. Classic Votifier v1 encrypts a 2048-bit RSA packet;
its protocol cannot confirm reward execution. A successful write is recorded
as sent. Each notification attempt, DNS lookup included, has one five-second
deadline. Neither protocol confirms that a reward was granted in game. Service
names are limited to 162 UTF-8 bytes so a v1 vote always fits one RSA block.

Votes commit before notification delivery. Failed deliveries remain counted
and are visible to the owner. There is no automatic retry: these protocols
have no idempotency key, so retrying an uncertain delivery can grant duplicate
rewards. A vote with a reward host is recorded as `unconfirmed` before
delivery starts. If the process crashes or the final status cannot be saved,
it stays `unconfirmed`, meaning the outcome is unknown. Owners can investigate
their plugin logs and compensate players manually. No website vote is fabricated
for a connection test or failed submission.
