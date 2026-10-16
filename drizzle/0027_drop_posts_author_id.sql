DROP INDEX IF EXISTS "posts_authorId_idx";--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN IF EXISTS "author_id";