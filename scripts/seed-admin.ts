import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });

const ADMIN_ROLE = "admin";

// Pass the email as an argument (`pnpm db:seed:admin you@example.com`) or set
// ADMIN_EMAIL in .env.local.
const adminEmail = process.argv[2] ?? process.env.ADMIN_EMAIL;

if (!adminEmail) {
  console.error(
    "Usage: pnpm db:seed:admin <email> (or set ADMIN_EMAIL in .env.local)"
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const result = await pool.query(
  "UPDATE users SET role = $1 WHERE email = $2 RETURNING id, name, email, role",
  [ADMIN_ROLE, adminEmail]
);

if (result.rowCount === 0) {
  console.error(`No user found with email "${adminEmail}".`);
  await pool.end();
  process.exit(1);
}

const [user] = result.rows;
console.log(
  `✓ Set role="${user.role}" for ${user.name} <${user.email}> (${user.id})`
);

await pool.end();
