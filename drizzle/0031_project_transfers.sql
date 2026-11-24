CREATE TABLE "project_transfers" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"from_user_id" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"resolved_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"to_user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_transfers" ADD CONSTRAINT "project_transfers_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_transfers" ADD CONSTRAINT "project_transfers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_transfers" ADD CONSTRAINT "project_transfers_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_transfers_pending_project_idx" ON "project_transfers" USING btree ("project_id") WHERE "project_transfers"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "project_transfers_projectId_status_idx" ON "project_transfers" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "project_transfers_toUserId_status_idx" ON "project_transfers" USING btree ("to_user_id","status");--> statement-breakpoint
CREATE INDEX "project_transfers_fromUserId_status_idx" ON "project_transfers" USING btree ("from_user_id","status");