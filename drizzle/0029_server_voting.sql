CREATE TABLE "server_vote_config" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"voting_enabled" boolean DEFAULT false NOT NULL,
	"host" text,
	"port" integer,
	"protocol" text DEFAULT 'v2' NOT NULL,
	"service_name" text,
	"token" text,
	"public_key" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"project_id" uuid NOT NULL,
	"minecraft_username" text NOT NULL,
	"address" text,
	"edition" text NOT NULL,
	"delivery_status" text DEFAULT 'pending' NOT NULL,
	"delivery_detail" text,
	"voted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "total_votes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "server_vote_config" ADD CONSTRAINT "server_vote_config_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_votes" ADD CONSTRAINT "server_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_votes" ADD CONSTRAINT "server_votes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "server_vote_config_project_id_idx" ON "server_vote_config" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "server_votes_project_id_idx" ON "server_votes" USING btree ("project_id","voted_at");--> statement-breakpoint
CREATE INDEX "server_votes_user_id_idx" ON "server_votes" USING btree ("user_id");