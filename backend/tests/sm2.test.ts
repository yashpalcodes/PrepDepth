import { describe, it, expect } from "vitest";
import { newCard, reviewCard, MIN_EASE, DEFAULT_EASE, type Card } from "../src/scheduler/sm2";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const matureCard: Card = { ease: 2.5, intervalDays: 6, repetitions: 2, lapses: 0 };

describe("newCard", () => {
  it("starts with default ease and no history", () => {
    expect(newCard()).toEqual({ ease: DEFAULT_EASE, intervalDays: 0, repetitions: 0, lapses: 0 });
  });
});

describe("learning steps", () => {
  it("first Good review gives a 1 day interval", () => {
    const r = reviewCard(newCard(), 3, NOW);
    expect(r.intervalDays).toBe(1);
    expect(r.repetitions).toBe(1);
  });

  it("second Good review gives a 6 day interval", () => {
    const first = reviewCard(newCard(), 3, NOW);
    const second = reviewCard(first, 3, NOW);
    expect(second.intervalDays).toBe(6);
    expect(second.repetitions).toBe(2);
  });

  it("third Good review multiplies the interval by ease", () => {
    const r = reviewCard(matureCard, 3, NOW);
    expect(r.intervalDays).toBe(15); // 6 * 2.5
    expect(r.repetitions).toBe(3);
  });
});

describe("forgetting", () => {
  it("resets repetitions and interval, counts a lapse, lowers ease", () => {
    const r = reviewCard({ ease: 2.5, intervalDays: 30, repetitions: 5, lapses: 1 }, 1, NOW);
    expect(r.repetitions).toBe(0);
    expect(r.intervalDays).toBe(1);
    expect(r.lapses).toBe(2);
    expect(r.ease).toBe(2.3);
  });

  it("never lets ease drop below the minimum", () => {
    let card: Card = newCard();
    for (let i = 0; i < 20; i++) card = reviewCard(card, 1, NOW);
    expect(card.ease).toBe(MIN_EASE);
    expect(card.lapses).toBe(20);
  });

  it("never lets ease drop below the minimum on repeated Hard", () => {
    let card: Card = matureCard;
    for (let i = 0; i < 30; i++) card = reviewCard(card, 2, NOW);
    expect(card.ease).toBeGreaterThanOrEqual(MIN_EASE);
  });
});

describe("ease changes", () => {
  it("Hard lowers ease, Good keeps it, Easy raises it", () => {
    expect(reviewCard(matureCard, 2, NOW).ease).toBe(2.36);
    expect(reviewCard(matureCard, 3, NOW).ease).toBe(2.5);
    expect(reviewCard(matureCard, 4, NOW).ease).toBe(2.6);
  });
});

describe("interval growth", () => {
  it("Easy grows the interval more than Good, and Good more than Hard", () => {
    const hard = reviewCard(matureCard, 2, NOW).intervalDays;
    const good = reviewCard(matureCard, 3, NOW).intervalDays;
    const easy = reviewCard(matureCard, 4, NOW).intervalDays;
    expect(hard).toBeLessThan(good);
    expect(good).toBeLessThan(easy);
  });

  it("still grows by at least one day when ease is at its minimum", () => {
    const card: Card = { ease: MIN_EASE, intervalDays: 1, repetitions: 2, lapses: 0 };
    const r = reviewCard(card, 2, NOW);
    expect(r.intervalDays).toBeGreaterThan(1);
  });
});

describe("due date", () => {
  it("is exactly intervalDays after the given time", () => {
    const r = reviewCard(matureCard, 3, NOW);
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + 15 * DAY_MS);
  });
});

describe("purity", () => {
  it("does not modify the input card", () => {
    const input: Card = { ease: 2.5, intervalDays: 6, repetitions: 2, lapses: 0 };
    const copy = { ...input };
    reviewCard(input, 1, NOW);
    expect(input).toEqual(copy);
  });
});
