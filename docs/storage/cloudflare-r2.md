# Cloudflare R2

[Cloudflare R2](https://developers.cloudflare.com/r2/) is the production
object store for VoxelVein. R2 is S3-compatible, so the app talks to it
through the same `STORAGE_*` variables as any other provider — only the
values change.

R2 is chosen because it has **no egress fees**. Downloads are most of this
platform's traffic, and every download is a file served to a launcher.

For local development, see [RustFS](rustfs.md).

## What you need

* A Cloudflare account with **R2 enabled**. R2 must be purchased before
  tokens can be created; the free tier still requires a card on file.
* A bucket
* An API token with **Object Read & Write**, scoped to that bucket
* Optionally, a custom domain on the bucket

## 1. Create the bucket

In the Cloudflare dashboard: **R2 object storage** → **Create bucket**.

Pick a name. R2 bucket names are globally unique across all of R2, not
just your account, so `voxelvein` is likely taken — append something
account-specific. The name must be DNS-compatible: lowercase letters,
digits, and hyphens.

Leave the location as **Automatic** unless you have a specific data
residency requirement. A bucket created in a jurisdiction can only be
reached through that jurisdiction's endpoint, which is a change to
`STORAGE_ENDPOINT` if you later move it.

## 2. Connect a custom domain

**Settings** → **Public access** → **Connect Domain**, on something like
`cdn.voxelvein.example`.

Use a **separate domain from the app**. Uploaded files then never share
the app's origin or its cookies, and a compromised file cannot read
anything from the app's session.

This sets `STORAGE_PUBLIC_URL`. Leaving it unset is also valid: the app
then hands out presigned URLs valid for 5 minutes, which works but pushes
every download through the app's redirect and gives up CDN caching. Use
the custom domain in production.

## 3. Create the API token

**R2 object storage** → **Overview** → **Account Details** → **Manage**
next to **API Tokens** → **Create Account API token**.

Choose:

* **Object Read & Write** — read, write, and list objects. This is what
  the app needs: it uploads, reads, and deletes objects, and never
  creates or configures buckets.
* Scoped to **the one bucket**, not "any bucket in this account".

An **Account API token** outlives individual users and is what a server
should use. A **User API token** inherits that person's permissions and
goes inactive if they leave the account, so it is the wrong choice for a
deployed service.

> [!IMPORTANT] Cloudflare shows the **Secret Access Key** exactly once,
> on the page right after creation. There is no way to view it again —
> if you lose it, delete the token and create another.

Use **Object Read & Write**, not Admin. The Admin permissions also allow
creating and deleting buckets, which the app has no code path for.

## 4. Set the variables

```bash
STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_BUCKET=<bucket>
STORAGE_ACCESS_KEY_ID=<access key id>
STORAGE_SECRET_ACCESS_KEY=<secret access key>
STORAGE_FORCE_PATH_STYLE=false
STORAGE_PUBLIC_URL=https://cdn.voxelvein.example
STORAGE_MAX_FILE_BYTES=104857600
STORAGE_QUOTA_BYTES=9500000000
```

Find the account ID in the dashboard, or in the R2 endpoint Cloudflare
shows when you create a token.

`STORAGE_PUBLIC_URL` is only valid once a custom domain is connected. If
you skip that step, leave it unset and downloads will use presigned URLs.

### Jurisdictional buckets

A bucket created in the EU, FedRAMP, or a US jurisdiction is only
reachable through that jurisdiction's endpoint:

```text
https://<account-id>.eu.r2.cloudflarestorage.com
https://<account-id>.fedramp.r2.cloudflarestorage.com
https://<account-id>.us.r2.cloudflarestorage.com
```

Most S3 clients hold one endpoint, so the app can serve one jurisdiction
at a time. If you need several, that is a code change rather than a
configuration one.

### The quota

`STORAGE_QUOTA_BYTES` is enforced by the app from Postgres, and R2's free
tier is 10 GB of stored data. `9500000000` (9.5 GB) leaves room for
uploads that are in flight when the check runs. See
[Storage quota](object-storage.md#storage-quota).

Set it deliberately rather than relying on the free tier. Without it,
uploads stop when R2 does, which for a paid account is a surprise bill.

## CORS

R2 only needs CORS configured for **browser** access. VoxelVein does not
put object URLs in `<img>` or `fetch`: every upload goes through
`PUT /api/projects/.../files` and every download through
`/api/download/<fileId>`, both same-origin, both server-side.

So **no CORS configuration is needed**. If you add R2 custom domains for
browser-facing images later — project icons, gallery shots — configure
CORS then, and only for the bucket in question.

## Verify

Before deploying, check the credentials and the bucket from the
command line:

```bash
aws s3api head-bucket \
  --bucket <bucket> \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com
```

Then, on a deployed environment:

1. Upload a `.jar` as a verified creator. Storage failures surface as a
   `503` with the message from `loadStorageConfig`; see
   [Projects and Files](../content/projects.md).
2. Open the download link. It should redirect to
   `https://cdn.voxelvein.example/projects/...`.
3. Check the file is reachable **without** the app, on the CDN domain.
   That confirms the custom domain and the public bucket are both right.
4. Confirm the object's response has `Cache-Control: public,
   max-age=31536000, immutable`. The app sets that on upload so the CDN
   can cache forever; if it is missing, the cache is not working and every
   download goes to the origin.
5. Check **R2 → bucket → Settings** for usage, and **Admin → Storage** in
   the app for its own count. They should agree, since the app sums
   `project_files.size` in Postgres.

## Cost and limits

* **Storage** — billed per GB-month, with a free tier
* **Operations** — Class A (writes, listings) and Class B (reads) are
  billed separately per million
* **Egress** — free, which is the reason for using R2 here

The free tier's limits are in the [R2 pricing
documentation](https://developers.cloudflare.com/r2/pricing/). Exceeding
them does not hard-fail; the request is billed. That is exactly why
`STORAGE_QUOTA_BYTES` is worth setting: it turns an unbounded bill into a
`507` the creator sees.

## Troubleshooting

**`SignatureDoesNotMatch`**
: Wrong secret, or the endpoint does not match the token's account.

**`403` on upload, credentials are right**
: The token is scoped to another bucket, or has **Object Read** instead of
  **Object Read & Write**.

**`InvalidAccessKeyId`**
: The token was deleted in the dashboard.

**Downloads redirect to the API, not the CDN**
: `STORAGE_PUBLIC_URL` is unset or wrong.

**CDN returns `404`, the app's download works**
: The custom domain is not attached to the bucket, or DNS is not
  verified.

**Writes fail, reads work**
: The token has **Object Read** instead of **Object Read & Write**.

**`NoSuchBucket`**
: The bucket was renamed or deleted, or the endpoint is a different
  account.

Rotating the token means creating a new one in the dashboard, updating the
two `STORAGE_*` credentials, and restarting the app — it builds its
`S3Client` once and caches it, so it will not pick up a change to the
environment. Delete the old token once the new one is confirmed working.

## Related

* [Object Storage](object-storage.md) — how the app uses storage, and the
  quota rules
* [RustFS](rustfs.md) — the local development provider
* [Deploying with Dokploy](../deployment/dokploy.md) — where these
  variables go in a deploy
* [Projects and Files](../content/projects.md) — the upload and download
  flows
