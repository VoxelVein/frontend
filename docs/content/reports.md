# Reports

A member can report a project or another account. Reports land in a queue
on the admin panel's **Reports** tab, which a moderator works through.

## Where the control lives

`src/components/reports/report-dialog.tsx`, rendered in two places:

* on a project page (`project-detail.tsx`), for published projects only —
  a draft is visible solely to its owner and staff, so there is nothing for
  another member to report;
* on a public profile (`/u/$username`).

It is a plain button rather than something buried in a menu: a member who
can see something wrong should not have to go looking for the control.
On your own project or profile it renders an explanation instead — "This
is your project." — rather than nothing, because a control that is
silently absent is worse than one that says why.

The dialog states that nothing happens to the target automatically. That
is the whole point of the feature, and a report that read as a verdict
would be a lie.

## What a report is

| Field              | Notes                                              |
| ------------------ | -------------------------------------------------- |
| `target_kind`      | `project` or `user`                                |
| `project_id`       | Set for a project report; cascades on delete       |
| `reported_user_id` | Set for a user report; `set null` on delete        |
| `reporter_id`      | `set null` on delete                               |
| `reason`           | One of the closed list in `REPORT_REASONS`         |
| `details`          | Optional free text, capped at 2000 characters      |
| `status`           | `open`, `resolved`, or `dismissed`                 |

Two decisions worth knowing.

**One table for both kinds.** The inbox, the ordering, and the resolution
flow are written once rather than twice, and `target_kind` says which of
the two nullable id columns is the subject.

**A CHECK constraint enforces exactly one target.** `target_kind = 'project'`
requires `project_id` and forbids `reported_user_id`, and the reverse for
a user. An application-level "only set one" rule is a rule the next write
path forgets; this one is in the database, and `validateReportTarget`
exists only to produce a friendlier message than the constraint's.

A report outlives both of its people. The reporter's account and the
reported account can each be deleted while the row stays, which is why
every join in `listReports` is a `leftJoin` and the inbox renders
"Deleted user" rather than dropping the row. Evidence about a target is
worth keeping after the person who filed it leaves.

**A user is named by username, not by id.** `PublicProfile` deliberately
does not carry the account id, so a report filed from `/u/$username` has
no id to send without either leaking that id to every visitor or adding a
lookup the loader already does. The server resolves the username itself.
A project *is* named by id, because its document already carries one.

## Why a report's own reason list is closed

`REPORT_REASONS` is a fixed list rather than free text, so the inbox can
be triaged by reason and so "something else" stays a visible bucket
instead of becoming a dumping ground. `details` stays optional on
purpose: requiring prose makes people who know immediately that something
is wrong type filler instead, and a filler reason is worth less than a
bare, accurate category.

## Guards, in the order they apply

Every check is on the server. The dialog is a button on a public page, so
anything enforced only in the UI is enforced by nothing at all.

1. **Signed in.** Deliberately weaker than `requireUploader`: reporting is
   a safety valve, and gating it behind a verified email would mean the
   people most likely to need it — a banned or unverified account — could
   not use it.
2. **Not yourself.** Checked against the *resolved* id, so neither a
   differently-cased handle nor a rename slips past it.
3. **Rate limit.** `RATE_LIMITS.report` — 5 per hour, per account, keyed
   on the user id so a shared NAT does not throttle everyone behind it
   and reconnecting cannot buy more reports. This is the tightest bucket
   on the site and the only one measured in hours: a report is a queue a
   human has to work through, so flooding it is the abuse, not just an
   inconvenience.
4. **Target exists.** A report about something that is not there is
   refused with the same "no longer exists" wording either way, because
   from the reporter's side those are the same situation.
5. **No duplicate.** The rate limit bounds volume; this bounds
   duplication, so someone who disagrees with a decision cannot refile
   every few minutes and fill the queue with identical rows. Checked
   rather than enforced by a unique index, because the constraint only
   applies while a report is **open** — a resolved report must not block
   reporting the same thing again later.

## The queue

`AdminReports` (`src/components/admin/admin-reports.tsx`) lists reports
newest first with the reporter and the target joined in, and each row can
be closed two ways.

`resolved` and `dismissed` are kept apart on purpose. "Nobody did
anything" and "we decided this was fine" are very different answers to
"is this site policed?", and collapsing them loses the second one.

Both go through a confirmation dialog, and the confirm button is worded
differently from the row button it confirms ("Yes, mark actioned") —
two controls sharing an accessible name in one view is ambiguous to
announce and to click. A failure is reported *inside* the dialog rather
than in the panel behind it, since a message the modal has just hidden
from view is not a message.

The reporter is not notified either way.

## Permissions

`manageReports`, minimum **moderator**, and separate from
`manageUsers` on purpose: see [Admin Panel](admin-panel.md).

## Tests

* `src/lib/__tests__/reports.test.ts` — the target rules, the closed
  reason list, the length cap at and past its boundary, and the narrowing
  of stored columns.
* `src/components/__tests__/report-dialog.test.tsx` — both target kinds,
  the reason requirement, optional details, and an inline failure that
  keeps the dialog open.
* `src/components/__tests__/admin-reports.test.tsx` — the reporter and
  target being visible, a report whose people are deleted still listing,
  and the two resolutions staying distinguishable.

## Related

* [Admin Panel](admin-panel.md) — the tab and the capability
* [Projects](projects.md)
* [Hardening](../security/hardening.md#rate-limits)
