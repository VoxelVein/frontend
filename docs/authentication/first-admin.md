# Bootstrapping the First Admin

Every account is created with `role = 'user'`, and there is no path from
there to `admin` through the app itself. The only way to make the first
admin is to write the role in the database directly. This guide does that
on a production Dokploy deployment without a redeploy.

## Why the panel cannot bootstrap itself

Three rules combine into a dead end:

* `/admin` needs at least `moderator`. `beforeLoad` calls `requireAdmin()`
  (`src/routes/admin.tsx`), which returns `null` for anything below that.
* A signed-in visitor is then redirected to `/login`, whose own `beforeLoad`
  bounces them back to `/`. So a plain user clicking **Admin** appears to
  do nothing at all.
* Changing a role needs Better Auth's `POST /admin/set-role`, which requires
  the `user: ["set-role"]` statement. Only `admin` holds it
  (`src/lib/permissions.ts`).

So `user` cannot reach the panel, and the panel is the only place that can
grant `admin`. The role has to be seeded out of band.

The good news is that nothing needs a restart. Session caching is off, so
Better Auth reads the user row on every request. The next page load after
the update already sees the new role.

## Where the role lives

`users.role`, a `text` column added by `drizzle/0003_*.sql` as
`text DEFAULT 'user' NOT NULL`. It carries no `CHECK` constraint, so
Postgres itself accepts any string you write into it.

The three valid values are `user`, `moderator`, and `admin`, listed in
`ROLE_RANK` (`src/lib/roles.ts`). A typo is not a security hole: `hasRole()`
returns `false` for a role it does not recognise, so an unrecognised value
grants nothing rather than everything. See
[Admin Panel](../content/admin-panel.md) for what each role unlocks.

## 1. Make sure the account exists

Sign up on the production site first. The promotion updates an existing row;
it does not create one, and `UPDATE` against no match is a silent `UPDATE 0`.

Note the address you actually used. Better Auth lowercases emails before
storing them, so `You@Example.com` is stored as `you@example.com`, and a
later sign-in with the capitalised address still finds the same row.

## 2. Open the database terminal

In Dokploy, go to your project, then the environment, then the **Docker
Compose** service, then the **General** tab, and press **Open Terminal**.

The modal asks for a container and a shell. **Both defaults can be wrong**,
so check before you type anything:

* The modal pre-selects the *first* container it finds, which is one of the
  `node:24-alpine` app containers, not the database. Switch the dropdown to
  the container belonging to the `db` service, usually named
  `<app-name>-db-1`. `migrate` is no use either: it exits after applying
  migrations, and a stopped container cannot be exec'd into.
* The shell selector defaults to `bash`, which only the database has. If
  `bash` is unavailable, that is a second sign you are in the wrong
  container; `/bin/sh` is a fallback, not a fix.

Verify with one command before going further:

```sh
cat /etc/os-release | head -1
```

`Debian GNU/Linux 13 (trixie)` is the Postgres container. `Alpine Linux`
means you are in `web`, `api`, or `migrate`, and `psql` will report
`psql: not found`.

The three app images are `node:24-alpine`, so an Alpine root with no
`bash` and no `psql` is expected. The database is `postgres:18`, which is
Debian trixie and has both.

Local socket authentication inside the Postgres image is `trust`, so `psql`
never asks for a password.

If picking the right container proves awkward, skip the terminal entirely
and use [Over SSH](#over-ssh-to-the-dokploy-server), which needs no
container-name guessing.

## 3. Confirm you are in the right database

`compose.yaml` sets `POSTGRES_USER` and `POSTGRES_DB`, defaulting both to
`voxelvein`. Reading them from the container's own environment is safer
than repeating the value:

```bash
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt users"
```

A row for `users` means you are in the application's database. If it says
`does not exist`, the tables were never migrated here and you are pointed
at the wrong database.

## 4. Find the account

Run the select **before** the update, so a wrong address is obvious:

```bash
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT id, name, email, role, banned, deletion_requested_at
   FROM users
   WHERE lower(email) = lower('you@example.com');"
```

No rows means the address is wrong. List the accounts instead:

```bash
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT name, email, role, created_at FROM users ORDER BY created_at;"
```

`lower(email) = lower(...)` is deliberate. Better Auth normalises on the
way in, but the column is case-sensitive text with a plain unique index, so
a row inserted outside Better Auth would not be.

## 5. Promote

```bash
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "UPDATE users
   SET role = 'admin'
   WHERE lower(email) = lower('you@example.com')
   RETURNING id, name, email, role;"
```

`UPDATE 1` plus a row showing `admin` is the success case. Swap `admin` for
`moderator` if you only need the review queue and ban controls.

## 6. Confirm in the browser

Sign out and back in, or hard-reload. The role is read fresh on every
request, so a reload is enough; there is no cache to purge and no
deployment to trigger.

`/admin` should now open on the Users tab, with the role selector, the
Delete button, and the Sessions, Storage, Notifications, and Deletions
tabs visible. A moderator sees only Posts and Reviews.

## Other ways to run the same statement

### Over SSH to the Dokploy server

This is the most reliable route, because it runs on the host and can find
the database container by image rather than by name. It needs nothing from
the Dokploy UI.

Find the container. Filtering on the image sidesteps container naming
entirely:

```bash
docker ps --filter ancestor=postgres:18 --format '{{.Names}}  {{.Status}}'
```

Then resolve it into a variable and check the connection settings the
compose file gave it:

```bash
DB=$(docker ps -q --filter ancestor=postgres:18)
docker exec "$DB" printenv POSTGRES_USER POSTGRES_DB
```

Both should read `voxelvein`. If they read anything else, use those values
instead of the defaults below. Then continue with the same `psql` calls as
steps 3 to 5, prefixed with `docker exec -it "$DB"`:

```bash
docker exec -it "$DB" psql -U voxelvein -d voxelvein -c "\dt users"
```

#### Letting Compose resolve the service

`exec db` resolves the service through the compose file, so no container
name is needed at all. Dokploy checks the repository out under a directory
named after the app:

```bash
ls /etc/dokploy/compose/
cd /etc/dokploy/compose/voxelvein/code
docker compose -p voxelvein ps
docker compose -p voxelvein exec db psql -U voxelvein -d voxelvein -c "\dt users"
```

#### Why the app name, not `voxelvein-frontend`

Dokploy deploys with `docker compose -p <appName> ...`, so the Compose
project is Dokploy's **app name**. The `-p` flag takes precedence over the
`name: voxelvein-frontend` in `compose.yaml`, and Dokploy also writes
`COMPOSE_PROJECT_NAME` into the `.env` it generates beside the compose
file.

`docker compose ps` from the right directory prints the real container
names, so it is the fastest way to recover the convention if you need one:

```bash
docker ps -a --filter label=com.docker.compose.project=voxelvein \
  --format '{{.Names}}\t{{.Status}}'
```

Note the `-a`: it is what reveals the exited `migrate` container, which is
also why the terminal lists it and then fails to open it.

If the app is deployed to a Dokploy remote server, run all of this on that
server. `docker exec` is node-local, and the containers are not on the
manager node.

### From your own machine

`pnpm db:seed:admin you@example.com admin` runs the same update through a
small script (`scripts/seed-admin.ts`). It needs a `DATABASE_URL` for the
production database and network access to it.

```bash
DATABASE_URL='postgresql://voxelvein:<password>@<host>:5432/voxelvein' \
  pnpm db:seed:admin you@example.com admin
```

The script prints `✓ Set role="admin" for <name> <email> (<id>)`, or exits
non-zero if no user matched.

This is only practical when `DATABASE_URL` points at a database you can
reach. `compose.yaml` publishes no host ports, so with the bundled
Postgres you would need a tunnel first; the terminal above is less work.
The running containers cannot do it for you either, since the web image
ships only `.output` with no `node_modules` and no `scripts/`.

### As a repeatable Dokploy job

For a grant you expect to repeat, add a **Schedule Job** of type Compose,
target the `db` service, and set the command to a single `psql -tAc`
statement. Dokploy runs it with `docker exec`, and the job log holds the
output.

Two caveats: the target container must be running, and you should delete
the job once it has run. A cron entry that promotes the same address on a
schedule is a silent way to re-grant admin to an account you meant to
demote.

## Granting roles after that

Once one admin exists, use **Admin panel → Users → role selector**. That
path goes through Better Auth, which validates the role name against the
plugin's role map and refuses anything unrecognised.

## Troubleshooting

**`/admin` lands on the home page**
: The role is still `user`. `requireAdmin()` returned `null`, `/login`
  redirected back to `/`. Re-check `role` with the query in step 4.

**`role` is `admin`, but the panel still refuses**
: You are signed in as a different account. Google or GitHub sign-in can
  create a second row with another address, so list all users.

**The panel opens with only Posts and Reviews**
: The account is a `moderator`. `ADMIN_PANEL_ROLE` is `moderator`, which
  is enough to reach `/admin` but not to change roles.

**`UPDATE 0`**
: No row matched. The stored email differs from the one you typed. Run the
  `SELECT` from step 4 before the `UPDATE`.

**`psql: not found`**
: Wrong container. The terminal pre-selects the first container it finds,
  which is one of the `node:24-alpine` app containers. Switch the dropdown
  to the `db` container, or use [Over SSH](#over-ssh-to-the-dokploy-server).

**`bash` is not available in the shell selector**
: The same wrong-container symptom. `postgres:18` is Debian and has `bash`;
  the app images are Alpine and do not. Confirm with
  `cat /etc/os-release | head -1` before switching to `/bin/sh`.

**The `ls` output has `app` and no `boot`, `lib64`, or `docker-entrypoint.sh`**
: Definitively an app container, not Postgres. Those are Alpine root
  contents plus the `/app` workdir.

**`database "voxelvein" does not exist`**
: Wrong database, or migrations never ran against it. Print
  `$POSTGRES_USER` and `$POSTGRES_DB`, and check the **Deployments** log
  for the `migrate` service.

**The container list in the terminal is empty**
: The compose type is `Stack`, or the containers run on another node.
  `compose.yaml` uses `build:`, which Stack cannot do, so the compose
  type should be **Docker Compose**.

**The terminal reports that the shell does not exist**
: See `bash` above. This is a wrong-container symptom, not a missing shell.

**The `migrate` container will not open a terminal**
: It exits on purpose after running `drizzle-kit migrate`. A stopped
  container cannot be exec'd into; `docker ps -a` still lists it. Choose
  the `db` container.

**The account is promoted but sign-in is rejected**
: `banned` is true, or `deletion_requested_at` is set. Promoting a role
  clears neither flag, and a pending deletion keeps the account banned
  for its 14-day grace period.

## Related

* [Admin Panel](../content/admin-panel.md) — what each role unlocks
* [Dokploy](../deployment/dokploy.md) — the deployment this assumes
* [Sessions](sessions.md) — how long a session lives
* [Accounts](accounts.md) — how accounts are created and deleted
