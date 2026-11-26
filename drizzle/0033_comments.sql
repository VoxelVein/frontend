CREATE TABLE "comment_hearts" (
	"comment_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "comment_hearts_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"author_id" text,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"post_id" text,
	"review_id" uuid,
	"target_kind" text NOT NULL,
	CONSTRAINT "comments_one_target_check" CHECK ((
        ("comments"."target_kind" = 'post' AND "comments"."post_id" IS NOT NULL AND "comments"."review_id" IS NULL)
        OR
        ("comments"."target_kind" = 'review' AND "comments"."review_id" IS NOT NULL AND "comments"."post_id" IS NULL)
      ))
);
--> statement-breakpoint
ALTER TABLE "comment_hearts" ADD CONSTRAINT "comment_hearts_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_hearts" ADD CONSTRAINT "comment_hearts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_review_id_project_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."project_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_hearts_userId_idx" ON "comment_hearts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comments_postId_createdAt_idx" ON "comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_reviewId_idx" ON "comments" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "comments_parentId_idx" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "comments_authorId_idx" ON "comments" USING btree ("author_id");