# Player reviews

Every published project and server has a Reviews section on its public page.
Visitors see the newest reviews first, with a mean rating, and a signed-in
account can add one rating and an optional short note. These are player
opinions, not the staff review workflow described in
[Projects and Files](projects.md).

## Who can review

The rules live in `src/lib/project-reviews.ts` and are re-checked in
`src/lib/project-reviews.functions.ts` on every submission, so hiding a form in
the UI is never the only gate.

* A visitor must be signed in with a verified email, and a banned account
  cannot post.
* A **project** can only be reviewed after the account has downloaded one of
  its files, and only once that download is at least five seconds old. The
  download route records the fetch time per account and project; repeat
  downloads replace the timestamp.
* A **server** has no downloadable files, so a signed-in visitor can review it
  directly.
* One review per account and listing. The unique index on
  `(user_id, project_id)` is the backstop; the submit handler also checks
  first and returns a readable message.

The eligibility query returns a reason when the form cannot be shown:
sign-in, email verification, missing download, the five-second wait, or an
already-submitted review. After a download, the versions panel invalidates
that query and the panel polls for a few seconds until the gate opens. No
timer or cached client state grants permission on its own.

## Format

The selector is five star-shaped radio buttons: pointer users click a star and
keyboard users move between them with the arrow keys, Home and End. A rating is
required. The comment is optional, limited to 300 characters, and stored
trimmed; an empty comment becomes `null`. Blocked words are rejected by
`src/lib/content-filter.ts` both in the form (inline) and in the Valibot schema
at the write boundary. Reviews are ordered newest first and the mean is rounded
to one decimal. A deleted account's review stays on the listing under the label
"Deleted user".

## Creator responses

The project's owner may answer each review once, with a short note of at most
500 characters. Nobody else may respond: the form is only rendered for the
owner, and `createReviewResponse` re-checks `projects.owner_id` against the
session before writing the row. Review responses are comments with a
`review_id` rather than a `post_id`, so they share the nesting, author and
staff-heart rules with [blog comments](blog.md#comments). They cannot be
nested further, because only the creator may reply at all.

## Data and migrations

Two tables were added in `drizzle/0032_project_reviews.sql`:

* `project_downloads` — `(user_id, project_id)` with `downloaded_at`, one row
  per account and project. It is keyed only for signed-in accounts, since
  anonymous visitors cannot review.
* `project_reviews` — rating, optional comment, creation time, and the two
  ids. The author is `set null` when an account is deleted; the project
  cascades, so removing a listing removes its reviews.
* `comments` and `comment_hearts` (`drizzle/0033_comments.sql`) — the shared
  comment thread, staff hearts, and the creator's review responses.

Reads use the public read rate-limit bucket and writes use the content-write
bucket. Both are keyed on the account when signed in, falling back to the
client address for the public listing read.

## See also

* [Projects and Files](projects.md), for the public listing pages
* [Blog comments](blog.md#comments), the other surface using this thread
* [Server voting](server-voting.md), the other per-server player action
* [Notifications](notifications.md), the in-app inbox
