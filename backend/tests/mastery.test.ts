import { describe, it, expect } from "vitest";
import { patternMastery, type ReviewEvent } from "../src/scheduler/mastery";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);
const ev = (rating: 1 | 2 | 3 | 4, d = 0): ReviewEvent => ({ rating, reviewedAt: daysAgo(d) });

describe("patternMastery", () => {
  it("returns the neutral prior when there are no reviews", () => {
    expect(patternMastery([], NOW)).toBe(0.5);
  });

  it("one Easy review today raises mastery above neutral, but not to 1", () => {
    expect(patternMastery([ev(4)], NOW)).toBeCloseTo(0.75, 5);
  });

  it("one Forgot review today lowers mastery below neutral, but not to 0", () => {
    expect(patternMastery([ev(1)], NOW)).toBeCloseTo(0.25, 5);
  });

  it("more good evidence gives higher mastery than a single review", () => {
    const one = patternMastery([ev(3)], NOW);
    const many = patternMastery(Array.from({ length: 10 }, () => ev(3)), NOW);
    expect(many).toBeGreaterThan(one);
  });

  it("recent reviews matter more than old ones", () => {
    const forgotRecently = patternMastery([ev(3, 60), ev(1, 0)], NOW);
    const forgotLongAgo = patternMastery([ev(1, 60), ev(3, 0)], NOW);
    expect(forgotRecently).toBeLessThan(forgotLongAgo);
  });

  it("does not depend on the order of the events", () => {
    const a = patternMastery([ev(1, 5), ev(4, 1), ev(2, 20)], NOW);
    const b = patternMastery([ev(2, 20), ev(1, 5), ev(4, 1)], NOW);
    expect(a).toBeCloseTo(b, 10);
  });

  it("always stays between 0 and 1", () => {
    const low = patternMastery(Array.from({ length: 50 }, () => ev(1)), NOW);
    const high = patternMastery(Array.from({ length: 50 }, () => ev(4)), NOW);
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThanOrEqual(1);
  });

  it("an old review fades towards the neutral prior", () => {
    const fresh = patternMastery([ev(4, 0)], NOW);
    const old = patternMastery([ev(4, 120)], NOW);
    expect(Math.abs(old - 0.5)).toBeLessThan(Math.abs(fresh - 0.5));
  });
});
