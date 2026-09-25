CREATE TABLE "project_files" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"filename" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primary" boolean DEFAULT false NOT NULL,
	"sha1" text NOT NULL,
	"sha512" text NOT NULL,
	"size" bigint NOT NULL,
	"storage_key" text NOT NULL,
	"version_id" uuid NOT NULL,
	CONSTRAINT "project_files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "project_versions" (
	"changelog" text DEFAULT '' NOT NULL,
	"channel" text DEFAULT 'release' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"downloads" integer DEFAULT 0 NOT NULL,
	"game_versions" text[] NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loaders" text[] NOT NULL,
	"name" text NOT NULL,
	"project_id" uuid NOT NULL,
	"version_number" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"category" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"downloads" integer DEFAULT 0 NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"published_at" timestamp,
	"slug" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"summary" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"type" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_version_id_project_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."project_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_versions" ADD CONSTRAINT "project_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_files_versionId_idx" ON "project_files" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "project_files_sha1_idx" ON "project_files" USING btree ("sha1");--> statement-breakpoint
CREATE UNIQUE INDEX "project_versions_projectId_versionNumber_uidx" ON "project_versions" USING btree ("project_id","version_number");--> statement-breakpoint
CREATE INDEX "projects_ownerId_idx" ON "projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_type_idx" ON "projects" USING btree ("type");