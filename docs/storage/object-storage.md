# Object Storage

Uploaded files — mods, modpacks, plugins, resource packs, and shaders —
live in S3-compatible object storage. The app only uses the S3 API
(`@aws-sdk/client-s3`), so switching providers only means changing
environment variables.

| Where       | Provider                               |
| ----------- | -------------------------------------- |
| Production  | [Cloudflare R2](cloudflare-r2.md)      |
| Development | [RustFS](rustfs.md), or Garage (below) |

R2 is the production store because it has no egress fees, and downloads
are most of this platform's traffic.

Garage is still wired into `docker-compose.yml` and `just infra`, so it
remains the zero-setup local default. See
[Local setup with Garage](#local-setup-with-garage) at the bottom of this
page.

## How it works

`src/lib/storage.ts` is the only module that talks to storage:

* `uploadStream` streams the request body into a multipart upload. It
  computes SHA-1 and SHA-512 while streaming, and aborts past
  `STORAGE_MAX_FILE_BYTES`. On failure it deletes whatever was written.
* `getDownloadUrl` returns `STORAGE_PUBLIC_URL/<key>` when a public
  domain is configured. Otherwise it returns a presigned GET URL that is
  valid for 5 minutes.
* `deleteObjects` removes keys in batches of 1000.

Object keys are immutable:
`projects/<projectId>/<versionId>/<fileId>/<filename>`. Objects are
stored with `Content-Disposition: attachment` and a one-year `immutable`
cache header, so a CDN can cache them indefinitely.

## Images

Project icons and gallery images are stored in the same bucket, under
`projects/<projectId>/images/`. They differ from version files in three
ways:

* They are uploaded with `inline` disposition and a revalidating cache
  header, so a browser renders an icon instead of downloading it.
* They are never served through `/api/download/$fileId` and never count
  towards a version's download total. They are served by
  `/api/image/$imageId` instead, which applies the same published-state
  rule as a file download, so a draft project's icon stays private.
* They are **resized in the browser before upload**
  (`src/lib/image-resize.ts`), so the full-size original never reaches the
  bucket. An icon is stored with a longest edge of 512px and a gallery image
  1920px, which is past what either is displayed at. An image already
  smaller than that is uploaded untouched rather than re-encoded, so
  resizing never costs quality or adds bytes. The upload is still capped at
  8 MB server-side, and the `project_images` table records the real stored
  dimensions so the UI can reserve the right space before it loads.

Resizing client-side rather than on the server is deliberate: the original
is discarded in the browser, so it costs no storage, no server CPU per
upload, and no new native dependency.

Two deliberate exceptions:

* **GIF is never resized.** Canvas cannot preserve animation frames, so
  resizing would silently turn an animated GIF into a still image. GIFs are
  stored as they are, under the 8 MB cap.
* **PNG stays PNG**, so a transparent icon keeps its transparency. JPEGs are
  re-encoded as WebP at quality 0.9, which is much smaller for the same
  perceived quality.

Accepted types are PNG, JPEG, WebP, and GIF, chosen by sniffing the file's
leading bytes rather than trusting the request's `content-type`. SVG is
rejected on purpose: it is a scriptable document format, and these images
are served inline from the app's own origin.

A project has at most one icon, enforced by a partial unique index. Images
count toward `STORAGE_QUOTA_BYTES` along with version files, so the admin
storage panel and the site limit stay truthful.

## Configuration

| Variable                    | Description                            |
| --------------------------- | -------------------------------------- |
| `STORAGE_ENDPOINT`          | S3 API endpoint                        |
| `STORAGE_REGION`            | `garage` locally, `auto` for R2        |
| `STORAGE_BUCKET`            | Bucket name                            |
| `STORAGE_ACCESS_KEY_ID`     | Access key ID                          |
| `STORAGE_SECRET_ACCESS_KEY` | Secret access key                      |
| `STORAGE_FORCE_PATH_STYLE`  | `true` for Garage and RustFS           |
| `STORAGE_PUBLIC_URL`        | Optional public download domain        |
| `STORAGE_MAX_FILE_BYTES`    | Optional upload limit (default 100 MB) |
| `STORAGE_QUOTA_BYTES`       | Optional limit on total stored bytes   |
| `GARAGE_RPC_SECRET`         | Garage node secret (local only)        |
| `GARAGE_ADMIN_TOKEN`        | Garage admin API token (local only)    |

Storage is optional. Without the endpoint, bucket, and keys,
`loadStorageConfig()` throws `StorageError(notConfigured)` and the upload
route answers `503`; browse, search, and download links for projects that
have no files all keep working.

`STORAGE_FORCE_PATH_STYLE` defaults to `false`, which is right for R2.
Garage and RustFS need `true`, because both serve path-style addressing
(`/<bucket>/<key>`) while the AWS SDK defaults to virtual-host style.

## Storage quota

Set `STORAGE_QUOTA_BYTES` to cap the total size of all uploaded files.
For example, `9500000000` (9.5 GB) stays under R2's free 10 GB and leaves
room for uploads in progress. Without it, storage is unlimited.

Usage is the sum of `project_files.size` in Postgres, so it counts every
file uploaded through the app:

1. Before an upload starts, the server refuses it if the quota is full or
   the declared size doesn't fit. The upload stream is also capped at the
   space left.
2. After the file is stored, the server checks the quota again while
   holding a Postgres advisory lock and only then records the file. If
   parallel uploads used the space in the meantime, the file is deleted
   and the upload is refused.

Refused uploads get `507 Insufficient Storage`. Deleting versions or
projects frees space immediately.

In-flight uploads can briefly store more than the quota in the bucket
before the check removes them. Objects created outside the app (or left
behind if a storage delete fails) are not counted.

Admins see usage and the limit in the **Storage** tab of `/admin`. Above
90% it shows a warning. See [Admin Panel](../content/admin-panel.md).

## Local setup with Garage

1. Add the storage section from `.env.example` to `.env.local` and fill
   in the generated values:

   ```bash
   echo "GARAGE_RPC_SECRET=$(openssl rand -hex 32)"
   echo "GARAGE_ADMIN_TOKEN=$(openssl rand -base64 32)"
   echo "STORAGE_ACCESS_KEY_ID=GK$(openssl rand -hex 12)"
   echo "STORAGE_SECRET_ACCESS_KEY=$(openssl rand -hex 32)"
   ```

2. Start the infrastructure and prepare the bucket:

   ```bash
   just infra
   just storage-init   # or: pnpm storage:init
   ```

`scripts/garage-init.sh` assigns the single-node layout, creates the
bucket, imports the access key from `.env.local`, and grants it access.
It is safe to run more than once.

Garage's S3 API listens on `127.0.0.1:3900`. Without
`STORAGE_PUBLIC_URL`, downloads redirect to presigned Garage URLs.

To use RustFS instead — it has a web console, so the bucket and key are
created in a browser rather than by a shell script — see
[RustFS](rustfs.md).

## Related

* [RustFS](rustfs.md) — local development provider with a web console
* [Cloudflare R2](cloudflare-r2.md) — the production provider
* [Projects and Files](../content/projects.md)
* [Admin Panel](../content/admin-panel.md)
