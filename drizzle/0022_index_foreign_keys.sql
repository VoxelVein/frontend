CREATE INDEX "admin_notifications_userId_idx" ON "admin_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "admin_notifications_projectId_idx" ON "admin_notifications" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_reviewedBy_idx" ON "projects" USING btree ("reviewed_by");--> statement-breakpoint
CREATE INDEX "reports_reportedUserId_idx" ON "reports" USING btree ("reported_user_id");--> statement-breakpoint
CREATE INDEX "reports_projectId_idx" ON "reports" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "reports_resolvedById_idx" ON "reports" USING btree ("resolved_by_id");--> statement-breakpoint
CREATE INDEX "user_notifications_projectId_idx" ON "user_notifications" USING btree ("project_id");