# RustFS

[RustFS](https://rustfs.com) is an S3-compatible object storage server
written in Rust, licensed Apache 2.0. It is a drop-in alternative to
MinIO and Garage, so VoxelVein talks to it through the same `STORAGE_*`
variables it already uses — only the values change.

This guide covers running RustFS locally, creating the bucket and a scoped
access key **in the web console**, and pointing the app at it. For the
production provider, see [Cloudflare R2](cloudflare-r2.md).

## Why RustFS

* Apache 2.0, not AGPL — no licensing obligation on a closed-source product
* Faster than MinIO on small-object workloads, which is exactly what mod
  archives are
* Its own web console, so bucket and key management do not need the AWS CLI
* S3 API compatible, so `src/lib/storage.ts` needs no changes

The trade-off: it is a much younger project than MinIO or Garage. Pin the
version rather than tracking `latest` for anything you care about.

## Ports and processes

| Port   | What                                      |
| ------ | ----------------------------------------- |
| `9000` | S3 API — the endpoint the app connects to |
| `9001` | Web console — browser only, never the app |

The console is a separate listener from the API and can be disabled with
`RUSTFS_CONSOLE_ENABLE=false` once setup is done. It is on by default.

## Run it with Docker

RustFS's container runs as **UID/GID `10001:10001`**, not root. With a
bind-mounted host directory, that path must be writable by that user or
the container fails to start with a permission error. This is the single
most common reason a first run does not come up.

The simplest path, with named volumes so there is nothing to `chown`:

```bash
docker run -d \
  --name rustfs \
  -p 9000:9000 \
  -p 9001:9001 \
  -e RUSTFS_ACCESS_KEY=RUSTFSADMIN \
  -e RUSTFS_SECRET_KEY="$(openssl rand -hex 32)" \
  -e RUSTFS_CONSOLE_ENABLE=true \
  -v rustfs-data:/data \
  -v rustfs-logs:/app/logs \
  rustfs/rustfs:latest
```

With bind mounts instead, prepare the ownership first:

```bash
mkdir -p data logs
chown -R 10001:10001 data logs
```

### Set the root credentials

RustFS falls back to `rustfsadmin` / `rustfsadmin` when
`RUSTFS_ACCESS_KEY` and `RUSTFS_SECRET_KEY` are unset. Those are public.
The entrypoint prints a warning and starts anyway, so **change them before
binding the ports to anything but localhost.**

`RUSTFS_ACCESS_KEY` is embedded in a slash-delimited AWS SigV4 credential
scope, so it must not contain a `/`. Uppercase ASCII letters and digits
only, which is what RustFS generates itself:

```bash
openssl rand -hex 16 | tr '[:lower:]' '[:upper:]'
```

For a secret key, use a separate strong random value — not raw Base64
output. Both can be supplied through files instead of the environment,
which keeps them out of `docker inspect`:

```yaml
environment:
  - RUSTFS_ACCESS_KEY_FILE=/run/secrets/rustfs_access_key
  - RUSTFS_SECRET_KEY_FILE=/run/secrets/rustfs_secret_key
```

Only the first line of the file is read. Setting both the direct variable
and its `_FILE` variant for the same credential is a hard error, and an
empty file is too.

## Set up in the console

Everything below happens in a browser at `http://localhost:9001`.

### 1. Sign in

Use **Key Login** with the `RUSTFS_ACCESS_KEY` and `RUSTFS_SECRET_KEY` you
set above. The console also offers STS and OIDC login, but those only
appear when an identity provider is configured, and neither is what you
want for a local bucket.

If the login page cannot reach the server, open `/config` and set the
externally reachable address by hand; **Reset** clears it and **Skip**
returns to login. This is the usual fix when the console is behind a proxy
or bound to a host the browser cannot see.

### 2. Create the bucket

**Buckets** in the left navigation → **Create Bucket** in the top right →
enter a name → **Create**.

Bucket names must be DNS-compatible: lowercase, no underscores, globally
unique only within your own deployment. `voxelvein-dev` matches the
`.env.example` default.

The app needs no bucket configuration beyond existence. It does not use
versioning, lifecycle rules, or public ACLs, because every download goes
through `/api/download/<fileId>` first — see
[Object Storage](object-storage.md).

### 3. Create a scoped access key

**Access Keys** in the left navigation → **Add Access Key** in the top
right → set an **expiration time**, **name**, and **description** →
**Submit**. Then **Copy** or **Export** the key, because the secret is
shown only once.

Name it something that says who it is and when it expires, such as
`voxelvein-app-2026-12`, and give it an expiry. A dated key makes the
next rotation obvious instead of turning into archaeology.

The root credential is for administration. Day-to-day access should use
this scoped key, so a leak of the app's credentials cannot delete buckets
or read other data. See RustFS's IAM docs for users, groups, and policies
if you need finer control than a single key.

### 4. Optional: a bucket quota

RustFS supports a per-bucket quota, set in the bucket's configuration.
VoxelVein enforces its own ceiling from `STORAGE_QUOTA_BYTES` in Postgres,
so this is a second line of defence rather than the real limit — see
[Storage quota](object-storage.md#storage-quota). Two independent limits
that disagree are a support ticket waiting to happen, so pick one and
document which is which.

## Connect the app

Add the values the console gave you to `.env.local`:

```bash
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_REGION=us-east-1
STORAGE_BUCKET=voxelvein-dev
STORAGE_ACCESS_KEY_ID=<from Access Keys in the console>
STORAGE_SECRET_ACCESS_KEY=<from Access Keys in the console>
STORAGE_FORCE_PATH_STYLE=true
STORAGE_MAX_FILE_BYTES=104857600
```

`STORAGE_FORCE_PATH_STYLE=true` is the important one. RustFS serves
path-style addressing (`/<bucket>/<key>`), and the AWS SDK defaults to
virtual-host style, which would produce `voxelvein-dev.localhost:9000` and
fail. R2 wants the opposite; see [Cloudflare R2](cloudflare-r2.md).

`STORAGE_REGION` only signs the request. RustFS ignores it. The app
defaults to `auto` when unset, which is fine.

Leave `STORAGE_PUBLIC_URL` unset locally. Without it,
`getDownloadUrl` returns a presigned URL valid for 5 minutes, which
redirects correctly. Setting it to `http://localhost:9000` would serve
keys as bare public objects, bypassing the download counter.

### From Docker

If the app runs in a container, the endpoint is the service name, not
`localhost` — the app's container has its own loopback:

```bash
STORAGE_ENDPOINT=http://rustfs:9000
```

And if the RustFS container is on the same Compose network, it does not
need to publish `9000` at all.

## Verify

```bash
# Liveness — 200 while the process is up
curl -fsS http://localhost:9000/health
# Readiness — 200 only when storage and IAM are ready, 503 otherwise
curl -s http://localhost:9000/health/ready
# Console
curl -fsS http://localhost:9001/rustfs/console/health
```

Readiness is the more useful of the two: liveness answers as soon as the
process starts, so it says nothing about whether uploads will work. A
degraded node answers `503` with a `degradedReasons` list naming
`storage_quorum_unavailable`, `iam_not_ready`, or
`lock_quorum_unavailable`.

Then upload a real file, which is the only check that proves the whole
path works:

1. Sign in at `http://localhost:3000/signup` with Google or GitHub, so
   the account is email-verified and can upload. Password sign-ups
   cannot yet verify, see [Projects and Files](../content/projects.md).
2. Make yourself an admin, or use an existing admin:

   ```bash
   pnpm db:seed:admin you@example.com
   ```

3. Create a project, add a version, and upload a `.jar` or `.zip`. The
   version form shows a `<progress>` bar; storage errors surface as a
   `503` with the message from `loadStorageConfig`.
4. Open the version's download link. It should redirect to a presigned
   `localhost:9000` URL.
5. Check the object appeared under
   `projects/<projectId>/<versionId>/<fileId>/<filename>` in the
   console's bucket browser, and that the version's download count
   incremented.

To generate a valid test archive without hunting for a real mod:

```bash
mkdir -p demo/META-INF && printf 'Manifest-Version: 1.0\n' > demo/META-INF/MANIFEST.MF
cd demo && zip -r ../demo.jar META-INF
```

## Run RustFS with Compose

`just infra` starts Postgres and Garage, not RustFS. To use RustFS for
local development instead, add a service to a local override:

```yaml
# compose.rustfs.yaml
services:
  rustfs:
    image: rustfs/rustfs:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      RUSTFS_ACCESS_KEY: ${RUSTFS_ACCESS_KEY:?set RUSTFS_ACCESS_KEY}
      RUSTFS_SECRET_KEY: ${RUSTFS_SECRET_KEY:?set RUSTFS_SECRET_KEY}
      RUSTFS_CONSOLE_ENABLE: "true"
      RUSTFS_OBS_LOGGER_LEVEL: info
    volumes:
      - rustfs-data:/data
      - rustfs-logs:/app/logs
    restart: unless-stopped

volumes:
  rustfs-data:
  rustfs-logs:
```

```bash
docker compose -f docker-compose.yml -f compose.rustfs.yaml up -d
```

The `:?` form fails the stack when a variable is unset, which is what you
want — a RustFS silently falling back to `rustfsadmin` on a shared machine
is not a good surprise.

For a multi-drive deployment, `RUSTFS_VOLUMES` takes an ellipsis range
(`/data/rustfs{0...3}`) across separate volumes, and RustFS ships a
`volume-permission-helper` service that chowns them to `10001:10001`
before the main service starts. Single-node single-disk is fine for
development; see the [topology rules](https://docs.rustfs.com/en/installation)
before expanding one, because a single-disk deployment cannot grow in
place.

## Troubleshooting

**`SignatureDoesNotMatch` on upload**
: `STORAGE_FORCE_PATH_STYLE` is `false`. RustFS needs `true`.

**Connection refused on `localhost:9000` from a container**
: The app's container is using its own loopback. Use `http://rustfs:9000`.

**Container exits immediately with permission denied**
: A bind-mounted path is not owned by `10001:10001`.

**`403` on every request in the console**
: The key is scoped to a bucket the signed-in identity cannot reach, or
  the root credential was changed without restarting the server.

**Login page cannot reach the server**
: Open `/config` and set the address by hand.

**Uploads work, downloads 403**
: `STORAGE_PUBLIC_URL` is set to a bare endpoint. Unset it and use
  presigned URLs.

**Console login rejects a correct key**
: The key has passed its expiry, or the secret was not copied completely.

Rotate the app's key by creating a second one in the console, updating
`.env.local`, and restarting the dev server; delete the first once the
new one is confirmed working. The app builds its `S3Client` once and
caches it, so a changed key needs a restart.

## Related

* [Object Storage](object-storage.md) — how the app uses storage, and the
  quota rules
* [Cloudflare R2](cloudflare-r2.md) — the production provider
* [Projects and Files](../content/projects.md) — the upload and download
  flows
