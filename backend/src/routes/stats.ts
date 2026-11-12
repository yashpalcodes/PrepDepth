import { Router } from "express";
import { pool } from "../db/pool";
import { asyncHandler } from "../middleware/asyncHandler";
import { patternMastery } from "../scheduler/mastery";
import { loadReviewEvents } from "../services/masteryService";

export const statsRouter = Router();

const UPCOMING_DAYS = 14;

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

statsRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const userId: number = res.locals.userId;

    const [totals, reviews, upcoming] = await Promise.all([
      pool.query(
        `SELECT count(*)::int AS "totalCards",
                (count(*) FILTER (WHERE due_at <= now()))::int AS "dueNow",
                (count(*) FILTER (WHERE due_at >= now() + make_interval(days => $2)))::int AS later
         FROM user_problems
         WHERE user_id = $1 AND status = 'active'`,
        [userId, UPCOMING_DAYS]
      ),
      pool.query(
        `SELECT (count(*) FILTER (WHERE r.reviewed_at > now() - interval '7 days'))::int AS reviews7d,
                count(*)::int AS reviews30d,
                (count(*) FILTER (WHERE r.rating >= 2))::int AS recalled30d
         FROM reviews r
         JOIN user_problems up ON up.id = r.user_problem_id
         WHERE up.user_id = $1 AND r.reviewed_at > now() - interval '30 days'`,
        [userId]
      ),
      // Rolling 24-hour windows from now: day 0 = next 24h, day 1 = the 24h after, and so on.
      pool.query(
        `SELECT floor(extract(epoch FROM (due_at - now())) / 86400)::int AS day, count(*)::int AS count
         FROM user_problems
         WHERE user_id = $1 AND status = 'active'
           AND due_at > now() AND due_at < now() + make_interval(days => $2)
         GROUP BY day`,
        [userId, UPCOMING_DAYS]
      ),
    ]);

    const byDay = new Map<number, number>(upcoming.rows.map((r) => [r.day as number, r.count as number]));
    const days = Array.from({ length: UPCOMING_DAYS }, (_, day) => ({ day, count: byDay.get(day) ?? 0 }));

    const r = reviews.rows[0];
    res.json({
      ...totals.rows[0],
      reviews7d: r.reviews7d,
      reviews30d: r.reviews30d,
      // Share of reviews rated Hard or better. null until there is at least one review.
      recallRate30d: r.reviews30d > 0 ? r.recalled30d / r.reviews30d : null,
      days,
    });
  })
);
