/**
 * Seeds demo blog posts for local development.
 *
 *   pnpm db:seed:posts
 *
 * Posts belong to the first admin (see `pnpm db:seed:admin`). They are
 * published, because an unpublished post is invisible on the public site and
 * the home page would still look empty.
 *
 * Safe to re-run: posts that already exist are left alone.
 */
import { eq, inArray } from "drizzle-orm";

import { db, pool } from "../src/db/index.ts";
import { postAuthors, posts, users } from "../src/db/schema.ts";
import { DEMO_POSTS } from "./fixtures/demo-posts.ts";
import type { DemoPost } from "./fixtures/demo-posts.ts";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const findAuthorId = async (): Promise<string> => {
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  if (!admin) {
    throw new Error(
      "No admin user found. Sign up, then run `pnpm db:seed:admin <email>`."
    );
  }
  return admin.id;
};

const seedPost = async (demo: DemoPost, authorId: string, now: Date) => {
  // Staggered into the past so the home page shows a believable recent order
  // rather than three posts sharing one timestamp.
  const createdAt = new Date(now.getTime() - demo.daysAgo * DAY_IN_MS);

  const [row] = await db
    .insert(posts)
    .values({
      content: demo.content,
      createdAt,
      excerpt: demo.excerpt,
      published: true,
      slug: demo.slug,
      title: demo.title,
      updatedAt: createdAt,
    })
    .returning({ id: posts.id });

  // Authorship is a separate table, so a seeded post needs its byline written
  // too — without this it would render with no author at all.
  await db.insert(postAuthors).values({
    position: 0,
    postId: row.id,
    userId: authorId,
  });
};

const seedPosts = async () => {
  const [authorId, existing] = await Promise.all([
    findAuthorId(),
    db
      .select({ slug: posts.slug })
      .from(posts)
      .where(
        inArray(
          posts.slug,
          DEMO_POSTS.map((demo) => demo.slug)
        )
      ),
  ]);
  const existingSlugs = new Set(existing.map((row) => row.slug));
  const missing = DEMO_POSTS.filter((demo) => !existingSlugs.has(demo.slug));
  const now = new Date();

  await Promise.all(
    missing.map(async (demo) => {
      await seedPost(demo, authorId, now);
      console.log(`  + post ${demo.slug}`);
    })
  );
  console.log(
    `Seeded ${missing.length} demo posts (${existingSlugs.size} already existed).`
  );
};

try {
  await seedPosts();
} finally {
  await pool.end();
}
