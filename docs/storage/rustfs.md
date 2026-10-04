# RustFS

[RustFS](https://rustfs.com) is an S3-compatible object store written in
Rust and licensed Apache 2.0. VoxelVein talks to it through the same
`STORAGE_*` variables as any other provider, so switching to it changes
environment values and nothing in the code.

## Should you use it?

Local development defaults to **Garage**. `just infra` starts it and
`just storage-init` creates the bucket and the access key without a
browser. That is the path of least resistance and most people should
stay on it.

Reach for RustFS when you want to click through bucket and key
management in a browser, or you want an S3 server that is Apache 2.0
rather than AGPL. Its web console is the reason this guide exists.

|            | Garage                   | RustFS              |
| ---------- | ------------------------ | ------------------- |
| Started by | `just infra`             | step 2 below        |
| Set up by  | `scripts/garage-init.sh` | the web console     |
| License    | AGPL                     | Apache 2.0          |
| Console    | none                     | yes, on port `9001` |

It is a much younger project than Garage. Pin the version rather than
tracking `latest` for anything you would mind losing.

Production storage is [Cloudflare R2](cloudflare-r2.md), not either of
these.

## Before you start

* Docker, able to run containers
* Ports `9000` and `9001` free on the host
* A `.env.local` copied from `.env.example` — see
  [Setup](../development/setup.md)

RustFS has two listeners. The app only ever talks to the first.

| Port   | Listener                           |
| ------ | ---------------------------------- |
| `9000` | S3 API — the endpoint the app uses |
| `9001` | web console — browser only         |

The console can be turned off with `RUSTFS_CONSOLE_ENABLE=false` once
setup is done. It is on by default.

## 1. Generate the root credentials

RustFS falls back to `rustfsadmin` / `rustfsadmin` when these are unset,
and it prints a warning and starts anyway rather than refusing. Generate
real ones first.

Append them to `.env.local`. Both the container and the console login
read them from there, so nothing has to be remembered or copied between
windows:

```bash
key="RUSTFS$(openssl rand -hex 8 | tr '[:lower:]' '[:upper:]')"
echo "RUSTFS_ACCESS_KEY=$key" >> .env.local
echo "RUSTFS_SECRET_KEY=$(openssl rand -hex 32)" >> .env.local
```

The access key goes into a slash-delimited SigV4 credential scope, so it
must not contain a `/`. Uppercase letters and digits is the form RustFS
generates itself. The secret can be anything long and random.

## 2. Start the container

```bash
docker run -d \
  --name rustfs \
  --restart unless-stopped \
  --env-file .env.local \
  -p 9000:9000 \
  -p 9001:9001 \
  -e RUSTFS_ADDRESS=":9000" \
  -e RUSTFS_CONSOLE_ADDRESS=":9001" \
  -e RUSTFS_CONSOLE_ENABLE=true \
  -e RUSTFS_OBS_LOGGER_LEVEL=info \
  -e RUSTFS_OBS_LOG_DIRECTORY=/var/log/rustfs \
  -v rustfs-data:/data \
  -v rustfs-logs:/var/log/rustfs \
  rustfs/rustfs:latest /data
```

Named volumes mean there is nothing to prepare.

`--env-file` hands the container every variable in `.env.local`, not just
the two RustFS ones, and `docker inspect` can read them back. That is fine
for a development machine and worth knowing about if you reuse this
command anywhere else. To keep the container to just its own credentials,
pass them with `-e RUSTFS_ACCESS_KEY=... -e RUSTFS_SECRET_KEY=...` instead.

If you would rather bind mount a host directory, the container runs as
UID `10001`, so the path has to be owned by that user first:

```bash
mkdir -p data logs
chown -R 10001:10001 data logs
```

A first run that dies on a permission error is nearly always this.

## 3. Check it is up

```bash
curl -fsS http://localhost:9000/health
curl -fsS http://localhost:9001/rustfs/console/health
```

`/health` answers as soon as the process is up, which tells you nothing
about whether uploads will work. The readiness probe is the useful one:

```bash
curl -s http://localhost:9000/health/ready
```

`200` only when storage and IAM are ready. A degraded node answers `503`
with a `degradedReasons` list naming `storage_quorum_unavailable`,
`iam_not_ready`, or `lock_quorum_unavailable`.

## 4. Create the bucket

Open `http://localhost:9001` and sign in with **Key Login**, using the
two values from step 1. The console also offers STS and OIDC, but those
only appear once an identity provider is configured.

Then **Buckets** in the left navigation → **Create Bucket** in the top
right → a name → **Create**.

`voxelvein-dev` matches the `.env.example` default. Names must be
DNS-compatible, and uniqueness only matters within your own deployment.

The app needs nothing else on the bucket — no versioning, no lifecycle
rules, no public ACLs. Every download goes through
`/api/download/<fileId>` first. See [Object Storage](object-storage.md).

If the login page cannot reach the server, open `/config`, enter the
externally reachable address, and save once its health check passes.
**Reset** clears the saved address, **Skip** returns to login. This is
the usual fix when the console is behind a proxy.

## 5. Create a key for the app

**Access Keys** in the left navigation → **Add Access Key** in the top
right → an **expiration time**, **name**, and **description** →
**Submit**. Then **Copy** or **Export**, because the secret is shown once
and never again.

Name it for who it is and when it dies — `voxelvein-app-2026-12` — and
give it an expiry, so the next rotation is a date rather than an
archaeological dig.

The root credential is for administration. The app uses this scoped key
instead, so a leak of the app's credentials cannot delete buckets or
read anything else.

## 6. Point the app at it

Replace the storage section of `.env.local`:

```bash
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_REGION=us-east-1
STORAGE_BUCKET=voxelvein-dev
STORAGE_ACCESS_KEY_ID=<from Access Keys in the console>
STORAGE_SECRET_ACCESS_KEY=<from Access Keys in the console>
STORAGE_FORCE_PATH_STYLE=true
STORAGE_MAX_FILE_BYTES=104857600
```

`STORAGE_FORCE_PATH_STYLE=true` is the one that matters. RustFS defaults
to path-style addressing (`/<bucket>/<key>`); virtual-host style needs
wildcard DNS and `RUSTFS_SERVER_DOMAINS`, which `localhost` cannot
provide. The AWS SDK defaults to the opposite, which produces
`voxelvein-dev.localhost:9000` and fails. R2 wants `false`.

`STORAGE_REGION` only signs the request. RustFS ignores the value, so
this one is cosmetic.

Leave `STORAGE_PUBLIC_URL` unset. Without it, `getDownloadUrl` returns a
presigned URL valid for five minutes, which redirects correctly. Setting
it to `http://localhost:9000` would serve keys as bare public objects
and bypass the download counter.

If the app runs in a container, the endpoint is the service name rather
than `localhost`, because the app's container has its own loopback:

```bash
STORAGE_ENDPOINT=http://rustfs:9000
```

`STORAGE_QUOTA_BYTES` works the same as with any provider, and the app
enforces it. RustFS's own per-bucket quota is a second, separate limit
worth leaving unset — two ceilings that disagree are a support ticket
waiting to happen.

## 7. Prove it end to end

Uploading needs a verified email address, and password sign-ups cannot
get one because the app sends no email yet. Sign in at
`http://localhost:3000/signup` with **Google** or **GitHub**. See
[Projects and Files](../content/projects.md).

If you need to be an admin for this:

```bash
pnpm db:seed:admin you@example.com
```

Then create a project, add a version, and upload a `.jar` or `.zip`.
The version form shows a `<progress>` bar. A storage failure surfaces as
a `503` carrying the message from `loadStorageConfig`.

Open the version's download link. It should redirect to a presigned
`localhost:9000` URL, the download count should tick up, and the object
should appear in the console under
`projects/<projectId>/<versionId>/<fileId>/<​filename>`.

To make a valid test archive without hunting for a real mod:

```bash
mkdir -p demo/META-INF
printf 'Manifest-Version: 1.0\n' > demo/META-INF/MANIFEST.MF
cd demo && zip -r ../demo.jar META-INF
```

## Running with Compose instead

`just infra` starts Postgres, Garage, and Valkey — not RustFS. To use
RustFS instead, create `compose.rustfs.yaml` with a `rustfs` service and
name the services you want, leaving Garage out:

```yaml
# compose.rustfs.yaml
services:
  rustfs:
    image: rustfs/rustfs:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      RUSTFS_ACCESS_KEY: ${RUSTFS_ACCESS_KEY:?set it in .env.local}
      RUSTFS_SECRET_KEY: ${RUSTFS_SECRET_KEY:?set it in .env.local}
      RUSTFS_CONSOLE_ENABLE: "true"
      RUSTFS_OBS_LOGGER_LEVEL: info
      RUSTFS_OBS_LOG_DIRECTORY: /var/log/rustfs
    volumes:
      - rustfs-data:/data
      - rustfs-logs:/var/log/rustfs
    restart: unless-stopped

volumes:
  rustfs-data:
  rustfs-logs:
```

```bash
docker compose -f docker-compose.yml -f compose.rustfs.yaml \
  --env-file .env.local up -d db valkey rustfs
```

Naming the services replaces `just infra` and leaves Garage out. Compose
reads `.env` by default, so `--env-file .env.local` is what lets it pick
up the credentials from step 1 — the same flag `just infra` passes.

The `:?` form fails the stack when a variable is unset, which is what
you want — a RustFS silently falling back to `rustfsadmin` on a shared
machine is not a good surprise.

`docker-compose.yml` is the development stack. `compose.yaml` is the
production base that Dokploy deploys, and it has no storage service at
all, so the two are not interchangeable. See
[Docker](../deployment/docker.md).

## Rotating the app's key

Create a second key in the console, update the two `STORAGE_*` values in
`.env.local`, and restart the dev server. Delete the first once the new
one works. The app builds its `S3Client` once and caches it, so a changed
key is invisible until it restarts.

## Troubleshooting

**`SignatureDoesNotMatch` on upload**
: `STORAGE_FORCE_PATH_STYLE` is not `true`.

**Uploads return `503` and RustFS is running**
: `loadStorageConfig` threw. Usually `.env.local` was not saved, or the dev
  server was not restarted after it was.

**Connection refused on `localhost:9000` from a container**
: The app's container is using its own loopback. Use `http://rustfs:9000`.

**Container exits immediately, permission denied**
: A bind-mounted path is not owned by `10001:10001`.

**`403` on every request in the console**
: The key is scoped to a bucket the signed-in identity cannot reach, or the
  root credential changed without restarting the server.

**The login page cannot reach the server**
: Open `/config` and set the address by hand.

**Console login rejects a correct key**
: The key passed its expiry, or the secret was not copied completely.

**Uploads work, downloads `403`**
: `STORAGE_PUBLIC_URL` is set to a bare endpoint. Unset it and let
  `getDownloadUrl` issue presigned URLs.

**Downloads work but the counter never moves**
: The same cause. A bare `STORAGE_PUBLIC_URL` serves the object without
  passing through `/api/download/<fileId>`, so nothing increments.

**Logs are empty**
: Logs go to `/var/log/rustfs`, not wherever the volume happens to be
  mounted. `RUSTFS_OBS_LOG_DIRECTORY` has to point at the mount.

## Related

* [Object Storage](object-storage.md) — how the app uses storage, and the
  quota rules
* [Cloudflare R2](cloudflare-r2.md) — the production provider
* [Setup](../development/setup.md) — the rest of the local environment
* [Projects and Files](../content/projects.md) — the upload and download
  flows
