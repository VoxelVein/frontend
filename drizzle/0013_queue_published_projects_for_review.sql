-- Send every project that is currently public into the review queue.
--
-- Runs immediately after 0012, which adds the `submitted_at` column this
-- statement writes to. The two are kept in separate files on purpose: 0012 is
-- pure DDL and safe to read, while this is the one statement in the feature
-- that changes what users can see, so it can be reviewed and, if necessary,
-- held on its own.
--
-- OPERATIONAL IMPACT: after this runs, no project is publicly visible until an
-- admin approves it. In an environment with a populated catalogue that means
-- search, downloads, trending and every public project page go empty until the
-- queue is worked through. This is intentional and was an explicit decision.
--
-- Backward compatible: the old code still runs for a moment between this
-- migration finishing and the new containers serving. It filters public reads
-- on `status = 'published'`, so a project in `pending` reads as simply missing.
-- Nothing errors, it is only briefly invisible.
--
-- `submitted_at` is taken from `published_at` rather than now() so the review
-- queue is ordered by when the project was actually submitted, not by when
-- this migration happened to run. Projects that were somehow published
-- without a timestamp fall back to now() so they still sort deterministically.
--
-- `reviewed_at` and `reviewed_by` are deliberately left null: these projects
-- have not been reviewed, and claiming otherwise would make the audit trail
-- lie. `rejection_reason` is left untouched for the same reason.
--
-- `published_at` is intentionally preserved rather than cleared. Re-approving
-- a project keeps its original publication date, which is what "first
-- published" should mean.
UPDATE "projects"
SET "status" = 'pending',
    "submitted_at" = COALESCE("published_at", now())
WHERE "status" = 'published';
