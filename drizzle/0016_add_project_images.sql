CREATE TABLE "project_images" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"content_type" text NOT NULL,
	"height" integer NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"project_id" uuid NOT NULL,
	"size" bigint NOT NULL,
	"storage_key" text NOT NULL,
	"width" integer NOT NULL,
	CONSTRAINT "project_images_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "project_images" ADD CONSTRAINT "project_images_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_images_projectId_icon_uidx" ON "project_images" USING btree ("project_id") WHERE "project_images"."kind" = 'icon';--> statement-breakpoint
CREATE INDEX "project_images_projectId_createdAt_idx" ON "project_images" USING btree ("project_id","created_at");