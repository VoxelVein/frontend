CREATE TABLE "project_server_links" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"linked_project_id" uuid NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"server_id" uuid NOT NULL,
	CONSTRAINT "project_server_links_server_id_linked_project_id_pk" PRIMARY KEY("server_id","linked_project_id")
);
--> statement-breakpoint
CREATE TABLE "project_servers" (
	"address" text NOT NULL,
	"game_versions" text[] DEFAULT '{}' NOT NULL,
	"port" integer,
	"project_id" uuid PRIMARY KEY NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_server_links" ADD CONSTRAINT "project_server_links_linked_project_id_projects_id_fk" FOREIGN KEY ("linked_project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_server_links" ADD CONSTRAINT "project_server_links_server_id_project_servers_project_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."project_servers"("project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_servers" ADD CONSTRAINT "project_servers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_server_links_linkedProjectId_idx" ON "project_server_links" USING btree ("linked_project_id");