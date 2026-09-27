CREATE TABLE "user_notifications" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message" text NOT NULL,
	"project_id" uuid NOT NULL,
	"read_at" timestamp,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_notifications_userId_readAt_idx" ON "user_notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "user_notifications_userId_createdAt_idx" ON "user_notifications" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_status_submittedAt_idx" ON "projects" USING btree ("status","submitted_at");