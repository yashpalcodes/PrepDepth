import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/errors";

const params = z.object({ id: z.coerce.number().int().positive() });

export const cardsRouter = Router();

// The review screen calls this AFTER the user has written their own recall.
cardsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId: number = res.locals.userId;
    const { id } = params.parse(req.params);

    const result = await pool.query(
      `SELECT up.id::int AS id, p.title, p.platform, p.url, p.difficulty,
              up.due_at AS "dueAt", up.ease, up.interval_days AS "intervalDays",
              up.repetitions, up.lapses,
              n.approach_text AS "approachText", n.key_insight AS "keyInsight",
              COALESCE(array_agg(pt.name ORDER BY pt.name) FILTER (WHERE pt.id IS NOT NULL), '{}') AS patterns
       FROM user_problems up
       JOIN problems p ON p.id = up.problem_id
       LEFT JOIN notes n ON n.user_problem_id = up.id
       LEFT JOIN problem_patterns pp ON pp.problem_id = p.id
       LEFT JOIN patterns pt ON pt.id = pp.pattern_id
       WHERE up.id = $1 AND up.user_id = $2
       GROUP BY up.id, p.id, n.id`,
      [id, userId]
    );
    if (result.rows.length === 0) throw new HttpError(404, "Card not found");

    const { approachText, keyInsight, ...card } = result.rows[0];
    res.json({ ...card, notes: approachText || keyInsight ? { approachText, keyInsight } : null });
  })
);
