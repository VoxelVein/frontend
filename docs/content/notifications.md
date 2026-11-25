# Notifications

Two inboxes, deliberately separate:

* **`user_notifications`**, addressed to one account, shown in the navbar
  bell and on the full `/notifications` page.
* **`admin_notifications`**, a shared inbox every admin reads, rendered by
  the admin panel's Notifications tab.

A member is told when a moderator reviews one of their projects, and when a
moderator looks at something they reported. A staff member is told when
something needs their attention. Nothing else notifies anybody, which is
deliberate: a notification that reports a fact the reader can already see
somewhere else is noise, and noise is what makes people stop opening the bell.

## The kinds, and what each is for

`USER_NOTIFICATION_TYPES` in `src/lib/notifications.ts`:

| Kind                        | Says                                     |
| --------------------------- | ---------------------------------------- |
| `project-approved`          | An admin approved a submitted project    |
| `project-rejected`          | An admin asked for changes, with reasons |
| `report-resolved`           | A moderator actioned something reported  |
| `report-dismissed`          | A moderator looked and disagreed         |
| `project-transfer-offered`  | A project offer awaits their decision    |
| `project-transfer-accepted` | Their offer was accepted                 |
| `project-transfer-declined` | Their offer was declined                 |

Each has a `tone`, and the tone drives the row's icon tile and its unread
background from one place, so the two cannot disagree. Approval and rejection
deliberately get different tones: they are the two outcomes a creator most
needs to tell apart at a glance, and they are exactly the rows that would
otherwise look identical.

An unrecognised kind renders as a plain neutral tile rather than blanking the
panel. A row written by a newer deploy should still be readable by an older
one.

## Why the panel does not claim an empty inbox while loading

The list loads on open, so there is a window where the panel has no data. The
earlier version rendered "Nothing here yet" throughout it, so opening the
bell with twenty unread notifications told the reader they had none, for as
long as the request took.

It now renders skeleton rows instead. This was locked in by a test that asserted
the old behaviour, which is the only reason it survived as long as it did.

A failed load on the full page keeps its sentence and its retry together in one
block, and the Sonner toast carries the underlying server message rather than a
generic replacement.

## Reading the list

**Grouped by day**, under Today / Yesterday / Earlier. Compared against whole
local days rather than 24 hours ago, so an 11pm notification read at 9am says
"Yesterday" instead of sliding into "Earlier" as the hours pass.

**Relative timestamps**, with the absolute date kept on the `<time>` element's
`title`. The question a reader has is "is this new?", which a date only answers
by making them do the arithmetic.

**The project name on the row**, joined in with the notification. "Needs
changes" without naming the project makes the reader open each one to find out
which, which is the opposite of a summary.

**Unread as a background, not only a dot.** The dot is decoration; the
screen-reader word is `sr-only`, because a bare dot announces nothing.

## Read, and dismissed, two different things

Marking read and dismissing are separate actions on purpose.

Marking read clears the badge and leaves the row in place, so the next visit
looks identical to the one before. Nothing ever gets shorter. The list
silently fills to its 50-row cap and then stops showing anything new, while
looking exactly as it did a week ago.

So there is also **Dismiss** on every row, and **Clear read notifications**
once nothing is unread. Only read rows are cleared in bulk: clearing an unread
row would discard it before the reader had seen it, which is not what "tidy
up" means.

## The full page

The bell is a glance: it loads at most 50 rows and opens on demand. Its footer
links to `/notifications`, which presents the same information with its own row
design inside a single Card with a `CardHeader` - dividers instead of row cards,
and an accent for unread instead of a tinted background. It adds All / Unread /
Read tabs, a text search over title, message and project name, and the bulk
actions that no longer fit in a popup. Both views share `USER_NOTIFICATION_KEYS`,
so a row marked read on one view updates the badge and the other view
immediately.

The page uses TanStack Query rather than the bell's open-time state: it is a
destination, so its data is cached and refetched like any other list.

## The badge

The unread count is a separate query from the list, because the list is capped
and the count is not: a reader with more unread notifications than the list
limit would otherwise be told they have exactly as many as happen to fit.

It is a `useQuery` rather than mount-time state, so it is cached and shared
across route changes. As mount-time state it was a server round-trip on every
single page, for a badge that almost never changes between two of them.

## Rows without a destination

A report outcome has no project, so the row is not a link. A control that goes
nowhere is worse than no control, and the message is the whole notification.

`user_notifications.project_id` is nullable for exactly this reason. It was
`NOT NULL` before report outcomes existed, which meant the only way to notify a
reporter was to attach the notification to some arbitrary project, a link to
somewhere unrelated. Migration `0020` dropped the constraint.

A row about a project still cascades with it, so a notification can never point
at something that no longer exists.

## On a phone

The desktop bell stays in the navbar, but the avatar menu does not: it moved
to a small button fixed to the bottom-right corner. The signed-in drawer renders
the bell as a labelled row beside My projects, Support, Settings, and Admin
panel, so the inbox stays reachable without opening a popup and the unread
badge stays visible in the row.

## Tests

* `src/lib/__tests__/notifications.test.ts`, the day buckets, including that
  a future timestamp is still "today" and that 11pm read at 9am is "yesterday";
  and that the two project outcomes get different tones.
* `src/components/__tests__/user-notifications.test.tsx`, the loading state
  never claiming an empty inbox, a load failure being distinguishable from an
  empty one, grouping, the relative timestamp, a report row having no link, and
  dismiss existing independently of mark-as-read.

## Related

* [Reports](reports.md), where two of these kinds come from
* [Admin Panel](admin-panel.md), the admin-side inbox
