CREATE TABLE "user_images" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"content_type" text NOT NULL,
	"height" integer NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"size" bigint NOT NULL,
	"storage_key" text NOT NULL,
	"width" integer NOT NULL,
	CONSTRAINT "user_images_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "user_images" ADD CONSTRAINT "user_images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_images_userId_uidx" ON "user_images" USING btree ("user_id");