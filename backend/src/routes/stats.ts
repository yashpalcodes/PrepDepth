import { Router } from "express";
import { pool } from "../db/pool";
import { asyncHandler } from "../middleware/asyncHandler";
import { patternMastery } from "../scheduler/mastery";
import { loadReviewEvents } from "../services/masteryService";

export const statsRouter = Router();

statsRouter.get(
  "/patterns",
  asyncHandler(async (_req, res) => {
    const userId: number = res.locals.userId;
    const now = new Date();

    const counts = await pool.query(
      `SELECT pt.id::int AS "patternId", pt.name,
              count(DISTINCT up.id)::int AS cards,
              (count(DISTINCT up.id) FILTER (WHERE up.due_at <= now()))::int AS "dueNow"
       FROM user_problems up
       JOIN problem_patterns pp ON pp.problem_id = up.problem_id
       JOIN patterns pt ON pt.id = pp.pattern_id
       WHERE up.user_id = $1 AND up.status = 'active'
       GROUP BY pt.id, pt.name`,
      [userId]
    );

    const events = await loadReviewEvents(userId);

    const rows = counts.rows.map((r) => {
      const list = events.get(r.patternId) ?? [];
      const last = list.reduce<Date | null>(
        (max, e) => (max === null || e.reviewedAt > max ? e.reviewedAt : max),
        null
      );
      return {
        ...r,
        mastery: Math.round(patternMastery(list, now) * 100) / 100,
        recentReviews: list.length, // 0 means "no data yet": mastery is just the 0.5 prior
        lastReviewedAt: last,
      };
    });

    rows.sort((a, b) => a.mastery - b.mastery || a.name.localeCompare(b.name));
    res.json(rows);
  })
);
