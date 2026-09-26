-- Concurrent uploads could previously store two files with the same name, or
-- two primary files, in one version. Make existing rows satisfy the new unique
-- indexes: keep the oldest file's name and suffix later duplicates with their
-- id (before the extension), and keep only the oldest primary file.
UPDATE "project_files" SET "filename" = regexp_replace("filename", '(\.[^.]*)?$', '-' || left("id"::text, 8) || '\1')
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (PARTITION BY "version_id", "filename" ORDER BY "created_at", "id") AS "rank"
    FROM "project_files"
  ) AS "ranked" WHERE "rank" > 1
);--> statement-breakpoint
UPDATE "project_files" SET "primary" = false
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (PARTITION BY "version_id" ORDER BY "created_at", "id") AS "rank"
    FROM "project_files" WHERE "primary"
  ) AS "ranked" WHERE "rank" > 1
);--> statement-breakpoint
DROP INDEX "project_files_versionId_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "project_files_versionId_filename_uidx" ON "project_files" USING btree ("version_id","filename");--> statement-breakpoint
CREATE UNIQUE INDEX "project_files_versionId_primary_uidx" ON "project_files" USING btree ("version_id") WHERE "project_files"."primary";