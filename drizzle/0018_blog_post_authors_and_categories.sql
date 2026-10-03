CREATE TABLE "post_authors" (
	"post_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "post_authors_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_author_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "author_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "post_authors" ADD CONSTRAINT "post_authors_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_authors" ADD CONSTRAINT "post_authors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_authors_userId_idx" ON "post_authors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_category_idx" ON "posts" USING btree ("category");--> statement-breakpoint
-- Carry every existing post's author over to `post_authors`, at position 0.
--
-- Restricted to admin and moderator accounts, matching what `requireAuthorIds`
-- accepts when the post is next saved. An author demoted since the post was
-- written is dropped rather than credited: the byline is a statement about who
-- is accountable for what the site publishes, and that is a staff property.
-- Such a post shows no byline until an editor picks an author for it.
INSERT INTO "post_authors" ("post_id", "user_id", "position")
SELECT "posts"."id", "posts"."author_id", 0
FROM "posts"
JOIN "users" ON "users"."id" = "posts"."author_id"
WHERE "posts"."author_id" IS NOT NULL
  AND "users"."role" IN ('admin', 'moderator')
ON CONFLICT DO NOTHING;