import "dotenv/config";
import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000, // allows for a paused database waking up
});

// Managed databases close idle connections. Without this handler,
// that event would crash the whole process.
pool.on("error", (err) => {
  console.error("Idle database client error:", err.message);
});
