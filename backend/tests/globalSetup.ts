import { execSync } from "node:child_process";
import { Client } from "pg";
import { TEST_DATABASE_URL } from "./testEnv";

// Runs once before all tests.
export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);

  // Safety: never run (and truncate) against anything that isn't a test database.
  if (!/^[a-z0-9_]+_test$/.test(dbName)) {
    throw new Error(`Refusing to run: "${dbName}" is not a test database name`);
  }

  // 1. Create the test database if it doesn't exist.
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (exists.rowCount === 0) await admin.query(`CREATE DATABASE ${dbName}`);
  } finally {
    await admin.end();
  }

  // 2. Migrate and seed it with the same scripts you use for dev.
  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL };
  execSync("npm run migrate", { stdio: "inherit", env });
  execSync("npm run seed", { stdio: "inherit", env });

  // 3. Start every run with no users, so old test data can't affect results.
  const db = new Client({ connectionString: TEST_DATABASE_URL });
  await db.connect();
  try {
    await db.query("TRUNCATE users RESTART IDENTITY CASCADE");
  } finally {
    await db.end();
  }
}
