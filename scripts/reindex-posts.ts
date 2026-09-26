/**
 * Rebuilds the Meilisearch posts index from the database.
 *
 *   pnpm db:reindex:posts
 *
 * Writes only ever reach the index when a post is created or edited, so a
 * deployment that already has posts needs this once to make them searchable.
 * It indexes drafts too, because the admin Posts tab searches them; the public
 * search route filters on `published` instead.
 */
import { Meilisearch } from "meilisearch";

import env from "../env.config.ts";
import { db, pool } from "../src/db/index.ts";
import { posts } from "../src/db/schema.ts";
import { toSearchDocument } from "../src/lib/posts-index.ts";
import { POSTS_INDEX, POSTS_INDEX_SETTINGS } from "../src/lib/posts-search.ts";

/**
 * Waits for a task and insists that it actually succeeded.
 *
 * Meilisearch reports a failed task in the returned task rather than by
 * throwing, so waiting alone is not enough: a rejected settings update or a
 * refused document batch would still let this script print its success line and
 * leave search quietly empty.
 */
const waitForSuccess = async (
  client: Meilisearch,
  taskUid: number,
  label: string
) => {
  const task = await client.tasks.waitForTask(taskUid);

  if (task.status !== "succeeded") {
    throw new Error(
      `Meilisearch ${label} ${task.status}: ${task.error?.message ?? "no reason given"}`
    );
  }
};

const reindex = async () => {
  const apiKey = env.MEILI_ADMIN_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "MEILI_ADMIN_KEY is required to rebuild the posts index. The web app never uses the master key."
    );
  }

  const client = new Meilisearch({ apiKey, host: env.MEILI_HOST });

  const settingsTask = await client
    .index(POSTS_INDEX)
    .updateSettings(POSTS_INDEX_SETTINGS);
  await waitForSuccess(client, settingsTask.taskUid, "settings update");

  const index = client.index(POSTS_INDEX);
  const clearTask = await index.deleteAllDocuments();
  await waitForSuccess(client, clearTask.taskUid, "document clear");

  const rows = await db.select().from(posts);
  const task = await index.addDocuments(rows.map(toSearchDocument));
  await waitForSuccess(client, task.taskUid, "document indexing");

  console.log(
    `Indexed ${rows.length} posts (${rows.filter((post) => post.published).length} published).`
  );
};

try {
  await reindex();
} finally {
  await pool.end();
}
