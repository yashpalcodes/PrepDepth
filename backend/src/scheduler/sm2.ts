/**
 * SM-2 spaced repetition scheduler.
 * Pure functions only: no database, no hidden clock.
 * Ratings: 1 = Forgot, 2 = Hard, 3 = Good, 4 = Easy.
 */

export type Rating = 1 | 2 | 3 | 4;

export interface Card {
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

export interface ReviewResult extends Card {
  dueAt: Date;
}

export const MIN_EASE = 1.3;
export const DEFAULT_EASE = 2.5;

const DAY_MS = 24 * 60 * 60 * 1000;

// Maps our 3 passing buttons to the original SM-2 quality scores (0-5).
const QUALITY: Record<2 | 3 | 4, number> = { 2: 3, 3: 4, 4: 5 };

// Round to 2 decimals so ease doesn't accumulate floating-point noise.
const round2 = (n: number) => Math.round(n * 100) / 100;

export function newCard(): Card {
  return { ease: DEFAULT_EASE, intervalDays: 0, repetitions: 0, lapses: 0 };
}

export function reviewCard(card: Card, rating: Rating, now: Date = new Date()): ReviewResult {
  let { ease, intervalDays, repetitions, lapses } = card;

  if (rating === 1) {
    // Forgot: start the learning steps again.
    repetitions = 0;
    intervalDays = 1;
    lapses += 1;
    ease = Math.max(MIN_EASE, round2(ease - 0.2));
  } else {
    const q = QUALITY[rating];

    // Standard SM-2 ease update.
    ease = Math.max(MIN_EASE, round2(ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))));

    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      // Always grow by at least one day, even when ease is at its minimum.
      intervalDays = Math.max(intervalDays + 1, Math.round(intervalDays * ease));
    }
    repetitions += 1;
  }

  const dueAt = new Date(now.getTime() + intervalDays * DAY_MS);
  return { ease, intervalDays, repetitions, lapses, dueAt };
}
