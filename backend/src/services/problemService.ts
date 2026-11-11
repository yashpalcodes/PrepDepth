import type { PoolClient } from "pg";
import { z } from "zod";
import { HttpError } from "../middleware/errors";

export const addProblemSchema = z.object({
  platform: z.string().trim().toLowerCase().min(1).default("leetcode"),
  externalId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  url: z
    .string()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), "must start with http:// or https://")
    .optional(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  patterns: z.array(z.string().trim().min(1)).min(1).max(5),
  solveMinutes: z.number().int().min(0).max(600).optional(),
  neededHint: z.boolean().default(false),
  approachText: z.string().max(5000).optional(),
  keyInsight: z.string().max(2000).optional(),
  // Days until the first review. Default 1 = "review it tomorrow".
  firstReviewInDays: z.number().int().min(0).max(30).default(1),
});

export type AddProblemInput = z.infer<typeof addProblemSchema>;

/** Adds a problem and this user's card. Call it inside a transaction. */
export async function addProblem(client: PoolClient, userId: number, input: AddProblemInput) {
  // 1. Find or create the problem.
  const prob = await client.query(
    `INSERT INTO problems (platform, external_id, title, url, difficulty)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (platform, external_id) DO UPDATE SET title = problems.title
     RETURNING id::int AS id`,
    [input.platform, input.externalId ?? null, input.title, input.url ?? null, input.difficulty]
  );
  const problemId: number = prob.rows[0].id;

  // 2. Resolve pattern names (case-insensitive). Reject unknown ones.
  const wanted = [...new Set(input.patterns.map((p) => p.toLowerCase()))];
  const found = await client.query(
    "SELECT id::int AS id, lower(name) AS name FROM patterns WHERE lower(name) = ANY($1)",
    [wanted]
  );
  const foundNames = new Set(found.rows.map((r) => r.name as string));
  const unknown = wanted.filter((w) => !foundNames.has(w));
  if (unknown.length > 0) {
    throw new HttpError(400, `Unknown pattern(s): ${unknown.join(", ")}`);
  }
  for (const row of found.rows) {
    await client.query(
      "INSERT INTO problem_patterns (problem_id, pattern_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [problemId, row.id]
    );
  }

  // 3. Create this user's card.
  let card;
  try {
    card = await client.query(
      `INSERT INTO user_problems (user_id, problem_id, solve_minutes, needed_hint, due_at)
       VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))
       RETURNING id::int AS id, due_at AS "dueAt"`,
      [userId, problemId, input.solveMinutes ?? null, input.neededHint, input.firstReviewInDays]
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw new HttpError(409, "You already added this problem");
    }
    throw err;
  }
  const userProblemId: number = card.rows[0].id;

  // 4. Optional note.
  if (input.approachText || input.keyInsight) {
    await client.query(
      "INSERT INTO notes (user_problem_id, approach_text, key_insight) VALUES ($1, $2, $3)",
      [userProblemId, input.approachText ?? null, input.keyInsight ?? null]
    );
  }

  return { id: userProblemId, problemId, title: input.title, dueAt: card.rows[0].dueAt };
}
