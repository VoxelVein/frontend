/**
 * Seeds demo mods and plugins for local development, then rebuilds the
 * Meilisearch projects index from the database.
 *
 *   pnpm db:seed:projects            # create missing demo projects + reindex
 *   pnpm db:seed:projects --reindex  # only rebuild the search index
 *
 * Demo projects belong to the first admin (see `pnpm db:seed:admin`). Each
 * gets one version with a tiny generated .jar uploaded to object storage.
 */
import { crc32 } from "node:zlib";

import { eq, inArray } from "drizzle-orm";
import { Meilisearch } from "meilisearch";

import env from "../env.config.ts";
import { db, pool } from "../src/db/index.ts";
import {
  projectFiles,
  projects,
  projectVersions,
  users,
} from "../src/db/schema.ts";
import {
  buildProjectDocument,
  PROJECTS_INDEX,
  PROJECTS_INDEX_SETTINGS,
} from "../src/lib/search-sync.ts";
import { uploadStream } from "../src/lib/storage.ts";
import { JAR_CONTENT_TYPE } from "../src/lib/upload-validation.ts";
import { DEMO_PROJECTS } from "./fixtures/demo-projects.ts";
import type { DemoProject } from "./fixtures/demo-projects.ts";

const LEGACY_INDEX = "mods";
const reindexOnly = process.argv.includes("--reindex");

/** Builds a valid single-entry, uncompressed zip (every .jar is a zip). */
const buildJar = (entryName: string, content: string): Uint8Array => {
  const name = Buffer.from(entryName);
  const data = Buffer.from(content);
  const checksum = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04_03_4b_50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02_01_4b_50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);

  const centralOffset = local.length + name.length + data.length;
  const centralSize = central.length + name.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06_05_4b_50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([local, name, data, central, name, end]);
};

const findOwnerId = async (): Promise<string> => {
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

const seedProject = async (demo: DemoProject, ownerId: string) => {
  const [project] = await db
    .insert(projects)
    .values({
      category: demo.category,
      description: `${demo.summary}\n\nThis is demo content for local development.`,
      downloads: demo.downloads,
      name: demo.name,
      ownerId,
      publishedAt: new Date(),
      slug: demo.slug,
      status: "published",
      summary: demo.summary,
      tags: demo.tags,
      type: demo.type,
    })
    .returning({ id: projects.id });

  const [version] = await db
    .insert(projectVersions)
    .values({
      gameVersions: demo.gameVersions,
      loaders: demo.loaders,
      name: demo.version,
      projectId: project.id,
      versionNumber: demo.version,
    })
    .returning({ id: projectVersions.id });

  const fileId = crypto.randomUUID();
  const filename = `${demo.slug}-${demo.version}.jar`;
  const storageKey = `projects/${project.id}/${version.id}/${fileId}/${filename}`;
  const jar = buildJar(
    "demo.txt",
    `${demo.name} ${demo.version} (VoxelVein demo file)\n`
  );
  const stored = await uploadStream({
    body: new Blob([new Uint8Array(jar)]).stream(),
    contentType: JAR_CONTENT_TYPE,
    filename,
    key: storageKey,
  });

  await db.insert(projectFiles).values({
    filename,
    id: fileId,
    primary: true,
    sha1: stored.sha1,
    sha512: stored.sha512,
    size: stored.size,
    storageKey,
    versionId: version.id,
  });
};

const seedProjects = async () => {
  const [ownerId, existing] = await Promise.all([
    findOwnerId(),
    db
      .select({ slug: projects.slug })
      .from(projects)
      .where(
        inArray(
          projects.slug,
          DEMO_PROJECTS.map((demo) => demo.slug)
        )
      ),
  ]);
  const existingSlugs = new Set(existing.map((row) => row.slug));
  const missing = DEMO_PROJECTS.filter((demo) => !existingSlugs.has(demo.slug));

  await Promise.all(
    missing.map(async (demo) => {
      await seedProject(demo, ownerId);
      console.log(`  + ${demo.type} ${demo.slug}`);
    })
  );
  console.log(
    `Seeded ${missing.length} demo projects (${existingSlugs.size} already existed).`
  );
};

const reindex = async () => {
  if (!env.MEILI_MASTER_KEY) {
    throw new Error("MEILI_MASTER_KEY is required to rebuild the index.");
  }
  const client = new Meilisearch({
    apiKey: env.MEILI_MASTER_KEY,
    host: env.MEILI_HOST,
  });

  await client.deleteIndexIfExists(LEGACY_INDEX);
  const index = client.index(PROJECTS_INDEX);
  const settingsTask = await index.updateSettings(PROJECTS_INDEX_SETTINGS);
  await client.tasks.waitForTask(settingsTask.taskUid);
  const clearTask = await index.deleteAllDocuments();
  await client.tasks.waitForTask(clearTask.taskUid);

  const published = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.status, "published"));
  const documents = await Promise.all(
    published.map((project) => buildProjectDocument(project.id))
  );
  const task = await index.addDocuments(
    documents.filter((document) => document !== null)
  );
  await client.tasks.waitForTask(task.taskUid);
  console.log(`Indexed ${published.length} published projects.`);
};

try {
  if (!reindexOnly) {
    await seedProjects();
  }
  await reindex();
} finally {
  await pool.end();
}
