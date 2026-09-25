import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import env from "../../env.config";
import {
  accounts,
  accountsRelations,
  passkeys,
  passkeysRelations,
  posts,
  postsRelations,
  projectFiles,
  projectFilesRelations,
  projectVersions,
  projectVersionsRelations,
  projects,
  projectsRelations,
  sessions,
  sessionsRelations,
  users,
  usersRelations,
  verifications,
} from "./schema";

const schema = {
  accounts,
  accountsRelations,
  passkeys,
  passkeysRelations,
  posts,
  postsRelations,
  projectFiles,
  projectFilesRelations,
  projectVersions,
  projectVersionsRelations,
  projects,
  projectsRelations,
  sessions,
  sessionsRelations,
  users,
  usersRelations,
  verifications,
};

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export const db = drizzle({
  client: pool,
  schema,
});

export { pool };
