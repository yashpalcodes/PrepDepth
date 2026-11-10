import { pool } from "./pool";
import { patterns, problems } from "./seed-data";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const p of patterns) {
      await client.query(
        `INSERT INTO patterns (name, description)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description`,
        [p.name, p.description]
      );
    }

    for (const pr of problems) {
      const res = await client.query(
        `INSERT INTO problems (platform, external_id, title, url, difficulty)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (platform, external_id)
         DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, difficulty = EXCLUDED.difficulty
         RETURNING id`,
        [pr.platform, pr.externalId, pr.title, pr.url, pr.difficulty]
      );
      const problemId = res.rows[0].id;

      for (const name of pr.patterns) {
        const pat = await client.query("SELECT id FROM patterns WHERE name = $1", [name]);
        if (pat.rowCount === 0) {
          throw new Error(`Unknown pattern "${name}" on problem "${pr.title}"`);
        }
        await client.query(
          `INSERT INTO problem_patterns (problem_id, pattern_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [problemId, pat.rows[0].id]
        );
      }
    }

    await client.query("COMMIT");
    console.log(`seeded ${patterns.length} patterns and ${problems.length} problems`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
