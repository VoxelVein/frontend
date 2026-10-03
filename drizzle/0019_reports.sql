CREATE TABLE "reports" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"details" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"reason" text NOT NULL,
	"reporter_id" text,
	"reported_user_id" text,
	"resolved_at" timestamp,
	"resolved_by_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"target_kind" text NOT NULL,
	CONSTRAINT "reports_one_target_check" CHECK ((
        ("reports"."target_kind" = 'project' AND "reports"."project_id" IS NOT NULL AND "reports"."reported_user_id" IS NULL)
        OR
        ("reports"."target_kind" = 'user' AND "reports"."reported_user_id" IS NOT NULL AND "reports"."project_id" IS NULL)
      ))
);
--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_status_createdAt_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_reporterId_idx" ON "reports" USING btree ("reporter_id");