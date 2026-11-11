/**
 * Pattern mastery: a 0..1 score computed from review history.
 * Pure function: the current time is passed in, never read from a hidden clock.
 */
import type { Rating } from "./sm2";

export interface ReviewEvent {
  rating: Rating;
  reviewedAt: Date;
}

export const RATING_SCORE: Record<Rating, number> = {
  1: 0, // Forgot
  2: 0.5, // Hard
  3: 0.85, // Good
  4: 1, // Easy
};

export const HALF_LIFE_DAYS = 14; // a review's weight halves every 14 days
export const PRIOR_SCORE = 0.5; // what we assume with no information
export const PRIOR_WEIGHT = 1; // how strongly we hold that assumption

const DAY_MS = 24 * 60 * 60 * 1000;

export function patternMastery(events: ReviewEvent[], now: Date = new Date()): number {
  let weightedSum = PRIOR_SCORE * PRIOR_WEIGHT;
  let totalWeight = PRIOR_WEIGHT;

  for (const e of events) {
    const ageDays = Math.max(0, (now.getTime() - e.reviewedAt.getTime()) / DAY_MS);
    const weight = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    weightedSum += weight * RATING_SCORE[e.rating];
    totalWeight += weight;
  }

  return weightedSum / totalWeight;
}
