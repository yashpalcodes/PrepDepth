import { Router } from "express";
import { z } from "zod";
import { withTransaction } from "../db/tx";
import { asyncHandler } from "../middleware/asyncHandler";
import { HttpError } from "../middleware/errors";
import { reviewCard, type Card } from "../scheduler/sm2";

const reviewSchema = z.object({
  userProblemId: z.number().int().positive(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  recallMinutes: z.number().int().min(0).max(600).optional(),
  recalledApproach: z.boolean().optional(),
});

export const reviewsRouter = Router();

reviewsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const userId: number = res.locals.userId;
    const input = reviewSchema.parse(req.body);

    const next = await withTransaction(async (client) => {
      // Lock the card row so two simultaneous reviews can't corrupt it.
      const current = await client.query(
        `SELECT ease, interval_days AS "intervalDays", repetitions, lapses
         FROM user_problems
         WHERE id = $1 AND user_id = $2 AND status = 'active'
         FOR UPDATE`,
        [input.userProblemId, userId]
      );
      if (current.rows.length === 0) {
        throw new HttpError(404, "Card not found");
      }

      const card: Card = current.rows[0];
      const result = reviewCard(card, input.rating, new Date()); // pure scheduler

      await client.query(
        `UPDATE user_problems
         SET ease = $1, interval_days = $2, repetitions = $3, lapses = $4, due_at = $5
         WHERE id = $6`,
        [result.ease, result.intervalDays, result.repetitions, result.lapses, result.dueAt, input.userProblemId]
      );
      await client.query(
        `INSERT INTO reviews (user_problem_id, rating, recall_minutes, recalled_approach)
         VALUES ($1, $2, $3, $4)`,
        [input.userProblemId, input.rating, input.recallMinutes ?? null, input.recalledApproach ?? null]
      );
      return result;
    });

    res.json({ userProblemId: input.userProblemId, ...next });
  })
);
