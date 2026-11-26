CREATE TABLE "project_downloads" (
	"downloaded_at" timestamp DEFAULT now() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_reviews" (
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"user_id" text
);
--> statement-breakpoint
ALTER TABLE "project_downloads" ADD CONSTRAINT "project_downloads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_downloads" ADD CONSTRAINT "project_downloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_reviews" ADD CONSTRAINT "project_reviews_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_reviews" ADD CONSTRAINT "project_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_downloads_userId_projectId_uidx" ON "project_downloads" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX "project_downloads_projectId_idx" ON "project_downloads" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_reviews_userId_projectId_uidx" ON "project_reviews" USING btree ("user_id","project_id");--> statement-breakpoint
CREATE INDEX "project_reviews_projectId_createdAt_idx" ON "project_reviews" USING btree ("project_id","created_at");