import "dotenv/config";
import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Serverless runs many instances at once, so keep each pool small (set DB_POOL_MAX=3 on Vercel).
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 15_000, // allows for a paused database waking up
});

// Managed databases close idle connections. Without this handler,
// that event would crash the process.
pool.on("error", (err) => {
  console.error("Idle database client error:", err.message);
});
