ALTER TABLE "project_files" ADD COLUMN "platform" text;
--> statement-breakpoint
DROP INDEX "project_files_versionId_filename_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX "project_files_versionId_filename_uidx" ON "project_files" USING btree ("version_id","filename") WHERE "platform" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "project_files_versionId_platform_uidx" ON "project_files" USING btree ("version_id","platform") WHERE "platform" IS NOT NULL;
