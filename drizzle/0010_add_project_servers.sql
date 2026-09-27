CREATE TABLE "project_servers" (
	"address" text NOT NULL,
	"game_versions" text[] DEFAULT '{}' NOT NULL,
	"modpack_id" uuid,
	"modpack_required" boolean DEFAULT false NOT NULL,
	"port" integer,
	"project_id" uuid PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_servers" ADD CONSTRAINT "project_servers_modpack_id_projects_id_fk" FOREIGN KEY ("modpack_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_servers" ADD CONSTRAINT "project_servers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_servers_modpackId_idx" ON "project_servers" USING btree ("modpack_id");