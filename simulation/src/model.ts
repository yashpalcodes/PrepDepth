/**
 * Synthetic learner. It uses the REAL scheduler modules from backend/src/scheduler,
 * so the simulation tests the code that actually ships.
 */
import { buildQueue, type DueCard } from "../../backend/src/scheduler/queue";
import { patternMastery, type ReviewEvent } from "../../backend/src/scheduler/mastery";
import { newCard, reviewCard, type Card, type Rating } from "../../backend/src/scheduler/sm2";
import { mulberry32 } from "./rng";

export type Strategy = "random" | "sm2" | "pattern";
export const STRATEGIES: Strategy[] = ["random", "sm2", "pattern"];

export interface Config {
  days: number;
  patterns: number;
  perPattern: number;
  newPerDay: number;
  limit: number; // reviews the learner can do per day
  transfer: number; // how much pattern skill helps every problem in that pattern (0 = none)
}

export const DEFAULT_CONFIG: Config = {
  days: 60,
  patterns: 12,
  perPattern: 10,
  newPerDay: 5,
  limit: 10,
  transfer: 0.8,
};

const DAY_MS = 86_400_000;
const START = Date.UTC(2026, 0, 1);
const SKILL_GAIN = 0.1; // pattern skill gained per review
const MAX_SKILL = 2;
const MIN_STABILITY = 0.5;
const MAX_STABILITY = 365;

const dayToDate = (day: number) => new Date(START + day * DAY_MS);

interface SimCard {
  id: number;
  patternId: number;
  addedDay: number;
  stability: number; // days
  lastDay: number; // last time it was seen (solved or reviewed)
  sm2: Card;
  dueDay: number;
}

function createCards(config: Config, rng: () => number): SimCard[] {
  // Each pattern has its own difficulty: base stability between 1 and 4 days.
  const base: number[] = [0];
  for (let p = 1; p <= config.patterns; p++) base.push(1 + rng() * 3);

  const total = config.patterns * config.perPattern;
  const cards: SimCard[] = [];
  for (let i = 0; i < total; i++) {
    const patternId = (i % config.patterns) + 1;
    const addedDay = Math.floor(i / config.newPerDay);
    cards.push({
      id: i + 1,
      patternId,
      addedDay,
      stability: base[patternId] * (0.8 + 0.4 * rng()),
      lastDay: addedDay,
      sm2: newCard(),
      dueDay: addedDay + 1, // same as the app's default: review tomorrow
    });
  }
  return cards;
}

/** Returns the average recall probability at the end of each day. */
export function simulate(config: Config, seed: number, strategy: Strategy): number[] {
  const cards = createCards(config, mulberry32(seed)); // same cards for every strategy
  const rng = mulberry32(seed + 1_000_003); // separate stream for review outcomes and shuffling
  const skill: number[] = new Array<number>(config.patterns + 1).fill(0);
  const events = new Map<number, ReviewEvent[]>(); // review history per pattern

  const recallProb = (c: SimCard, day: number): number =>
    Math.exp(-(day - c.lastDay) / (c.stability * (1 + config.transfer * skill[c.patternId])));

  function choose(day: number, added: SimCard[]): SimCard[] {
    if (strategy === "random") {
      const pool = added.filter((c) => c.addedDay < day);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, config.limit);
    }

    const due = added.filter((c) => c.dueDay <= day);

    if (strategy === "sm2") {
      return due.sort((a, b) => a.dueDay - b.dueDay || a.id - b.id).slice(0, config.limit);
    }

    // pattern-weighted: the real mastery and queue code
    const now = dayToDate(day);
    const mastery = new Map<number, number>();
    for (const [patternId, list] of events) mastery.set(patternId, patternMastery(list, now));
    const dueCards: DueCard[] = due.map((c) => ({
      id: c.id,
      patternIds: [c.patternId],
      dueAt: dayToDate(c.dueDay),
    }));
    const byId = new Map(due.map((c) => [c.id, c]));
    return buildQueue(dueCards, mastery, now, config.limit).map((d) => byId.get(d.id)!);
  }

  function review(c: SimCard, day: number): void {
    const now = dayToDate(day);
    const p = recallProb(c, day);
    const recalled = rng() < p;

    let rating: Rating;
    if (!recalled) rating = 1;
    else if (p < 0.6) rating = 2;
    else if (p < 0.9) rating = 3;
    else rating = 4;

    if (recalled) {
      c.stability = Math.min(MAX_STABILITY, c.stability * (1.4 + 1.5 * (1 - p)));
    } else {
      c.stability = Math.max(MIN_STABILITY, c.stability * 0.6);
    }
    skill[c.patternId] = Math.min(MAX_SKILL, skill[c.patternId] + SKILL_GAIN);
    c.lastDay = day;

    const next = reviewCard(c.sm2, rating, now); // the real SM-2
    c.sm2 = {
      ease: next.ease,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      lapses: next.lapses,
    };
    c.dueDay = day + next.intervalDays;

    const list = events.get(c.patternId) ?? [];
    list.push({ rating, reviewedAt: now });
    events.set(c.patternId, list);
  }

  const retention: number[] = [];
  for (let day = 0; day < config.days; day++) {
    const added = cards.filter((c) => c.addedDay <= day);
    for (const c of choose(day, added)) review(c, day);
    const mean = added.reduce((sum, c) => sum + recallProb(c, day), 0) / added.length;
    retention.push(mean);
  }
  return retention;
}
