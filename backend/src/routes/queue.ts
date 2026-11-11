import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { asyncHandler } from "../middleware/asyncHandler";
import { buildQueue, DEFAULT_DAILY_LIMIT, type DueCard } from "../scheduler/queue";
import { patternMastery, type ReviewEvent } from "../scheduler/mastery";
import type { Rating } from "../scheduler/sm2";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(DEFAULT_DAILY_LIMIT),
});

interface DueRow extends DueCard {
  title: string;
  url: string | null;
  difficulty: string;
  patterns: string[];
}

export const queueRouter = Router();

queueRouter.get(
  "/today",
  asyncHandler(async (req, res) => {
    const userId: number = res.locals.userId;
    const { limit } = querySchema.parse(req.query);
    const now = new Date();

    // 1. Cards that are due, each with its pattern ids and names.
    const dueResult = await pool.query(
      `SELECT up.id::int AS id, up.due_at AS "dueAt", p.title, p.url, p.difficulty,
              COALESCE(array_agg(pt.id::int ORDER BY pt.id) FILTER (WHERE pt.id IS NOT NULL), '{}') AS "patternIds",
              COALESCE(array_agg(pt.name ORDER BY pt.id) FILTER (WHERE pt.id IS NOT NULL), '{}') AS patterns
       FROM user_problems up
       JOIN problems p ON p.id = up.problem_id
       LEFT JOIN problem_patterns pp ON pp.problem_id = p.id
       LEFT JOIN patterns pt ON pt.id = pp.pattern_id
       WHERE up.user_id = $1 AND up.status = 'active' AND up.due_at <= now()
       GROUP BY up.id, p.id`,
      [userId]
    );
    const due = dueResult.rows as DueRow[];

    // 2. Recent review history, one row per (review, pattern of that problem).
    //    Reviews older than 180 days carry almost zero weight, so skip them.
    const history = await pool.query(
      `SELECT pp.pattern_id::int AS "patternId", r.rating, r.reviewed_at AS "reviewedAt"
       FROM reviews r
       JOIN user_problems up ON up.id = r.user_problem_id
       JOIN problem_patterns pp ON pp.problem_id = up.problem_id
       WHERE up.user_id = $1 AND r.reviewed_at > now() - interval '180 days'`,
      [userId]
    );

    // 3. Mastery per pattern (pure function).
    const events = new Map<number, ReviewEvent[]>();
    for (const row of history.rows) {
      const list = events.get(row.patternId) ?? [];
      list.push({ rating: row.rating as Rating, reviewedAt: row.reviewedAt });
      events.set(row.patternId, list);
    }
    const mastery = new Map<number, number>();
    for (const [patternId, list] of events) {
      mastery.set(patternId, patternMastery(list, now));
    }

    // 4. Build the queue (pure function), then attach the display fields back.
    const ordered = buildQueue(due, mastery, now, limit);
    const byId = new Map(due.map((d) => [d.id, d]));
    const cards = ordered.map((c) => {
      const d = byId.get(c.id)!;
      return {
        id: d.id,
        title: d.title,
        url: d.url,
        difficulty: d.difficulty,
        patterns: d.patterns,
        dueAt: d.dueAt,
      };
    });

    res.json({ date: now.toISOString(), totalDue: due.length, limit, cards });
  })
);
