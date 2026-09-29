import { config } from "dotenv";
import { Pool } from "pg";

import { ALL_ROLES, isRole } from "../src/lib/roles";

config({ path: ".env.local" });

/**
 * Grants a staff role to an account.
 *
 * Usage: `pnpm db:seed:admin <email> [role]`, or set ADMIN_EMAIL and
 * ADMIN_ROLE in .env.local. The role defaults to "admin" and may be any name
 * in the role ladder, so this is also how a moderator is created.
 */
const email = process.argv[2] ?? process.env.ADMIN_EMAIL;
const requestedRole = process.argv[3] ?? process.env.ADMIN_ROLE ?? "admin";

if (!email) {
  console.error(
    "Usage: pnpm db:seed:admin <email> [role] (or set ADMIN_EMAIL in .env.local)"
  );
  process.exit(1);
}

if (!isRole(requestedRole)) {
  console.error(
    `"${requestedRole}" is not a role. Expected one of: ${ALL_ROLES.join(", ")}.`
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const result = await pool.query(
  "UPDATE users SET role = $1 WHERE email = $2 RETURNING id, name, email, role",
  [requestedRole, email]
);

if (result.rowCount === 0) {
  console.error(`No user found with email "${email}".`);
  await pool.end();
  process.exit(1);
}

const [user] = result.rows;
console.log(
  `✓ Set role="${user.role}" for ${user.name} <${user.email}> (${user.id})`
);

await pool.end();
