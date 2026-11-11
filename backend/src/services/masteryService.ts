import { pool } from "../db/pool";
import { patternMastery, type ReviewEvent } from "../scheduler/mastery";
import type { Rating } from "../scheduler/sm2";

/** Reviews older than this carry almost zero weight, so we skip them. */
export const HISTORY_DAYS = 180;

/** Review events grouped by pattern id (one review counts for each pattern of its problem). */
export async function loadReviewEvents(userId: number): Promise<Map<number, ReviewEvent[]>> {
  const history = await pool.query(
    `SELECT pp.pattern_id::int AS "patternId", r.rating, r.reviewed_at AS "reviewedAt"
     FROM reviews r
     JOIN user_problems up ON up.id = r.user_problem_id
     JOIN problem_patterns pp ON pp.problem_id = up.problem_id
     WHERE up.user_id = $1 AND r.reviewed_at > now() - make_interval(days => $2)`,
    [userId, HISTORY_DAYS]
  );

  const events = new Map<number, ReviewEvent[]>();
  for (const row of history.rows) {
    const list = events.get(row.patternId) ?? [];
    list.push({ rating: row.rating as Rating, reviewedAt: row.reviewedAt });
    events.set(row.patternId, list);
  }
  return events;
}

/** Mastery score (0..1) per pattern id, from the pure scoring function. */
export function masteryByPattern(
  events: Map<number, ReviewEvent[]>,
  now: Date
): Map<number, number> {
  const mastery = new Map<number, number>();
  for (const [patternId, list] of events) {
    mastery.set(patternId, patternMastery(list, now));
  }
  return mastery;
}
