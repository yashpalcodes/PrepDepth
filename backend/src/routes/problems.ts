import { Router } from "express";
import { pool } from "../db/pool";
import { withTransaction } from "../db/tx";
import { asyncHandler } from "../middleware/asyncHandler";
import { addProblem, addProblemSchema } from "../services/problemService";

export const problemsRouter = Router();

problemsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const userId: number = res.locals.userId;
    const input = addProblemSchema.parse(req.body);
    const created = await withTransaction((client) => addProblem(client, userId, input));
    res.status(201).json(created);
  })
);

problemsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const userId: number = res.locals.userId;
    const result = await pool.query(
      `SELECT up.id::int AS id, p.title, p.platform, p.url, p.difficulty,
              up.due_at AS "dueAt", up.interval_days AS "intervalDays",
              up.repetitions, up.lapses,
              COALESCE(array_agg(pt.name ORDER BY pt.name) FILTER (WHERE pt.id IS NOT NULL), '{}') AS patterns
       FROM user_problems up
       JOIN problems p ON p.id = up.problem_id
       LEFT JOIN problem_patterns pp ON pp.problem_id = p.id
       LEFT JOIN patterns pt ON pt.id = pp.pattern_id
       WHERE up.user_id = $1 AND up.status = 'active'
       GROUP BY up.id, p.id
       ORDER BY up.due_at`,
      [userId]
    );
    res.json(result.rows);
  })
);
