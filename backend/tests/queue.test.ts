import { describe, it, expect } from "vitest";
import { buildQueue, type DueCard } from "../src/scheduler/queue";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);
const card = (id: number, patternIds: number[], dueDaysAgo = 0): DueCard => ({
  id,
  patternIds,
  dueAt: daysAgo(dueDaysAgo),
});
const ids = (cards: DueCard[]) => cards.map((c) => c.id);

describe("buildQueue", () => {
  it("returns an empty queue when nothing is due", () => {
    expect(buildQueue([], new Map(), NOW)).toEqual([]);
  });

  it("respects the daily limit", () => {
    const due = Array.from({ length: 12 }, (_, i) => card(i + 1, [1]));
    expect(buildQueue(due, new Map(), NOW, 10)).toHaveLength(10);
    expect(buildQueue(due, new Map(), NOW, 3)).toHaveLength(3);
  });

  it("puts cards from weaker patterns first", () => {
    const mastery = new Map([[1, 0.9], [2, 0.2]]);
    const result = buildQueue([card(1, [1]), card(2, [2])], mastery, NOW);
    expect(ids(result)).toEqual([2, 1]);
  });

  it("puts more overdue cards first when mastery is equal", () => {
    const due = [card(3, [1], 0), card(7, [1], 10)];
    expect(ids(buildQueue(due, new Map(), NOW))).toEqual([7, 3]);
  });

  it("uses the weakest pattern of a card that has several", () => {
    const mastery = new Map([[1, 0.9], [2, 0.1], [3, 0.5]]);
    const due = [card(1, [3]), card(2, [1, 2])]; // card 2 touches a very weak pattern
    expect(ids(buildQueue(due, mastery, NOW))).toEqual([2, 1]);
  });

  it("treats unknown patterns as neutral mastery", () => {
    const mastery = new Map([[1, 0.2]]); // pattern 2 unknown -> 0.5
    const result = buildQueue([card(1, [2]), card(2, [1])], mastery, NOW);
    expect(ids(result)).toEqual([2, 1]);
  });

  it("interleaves patterns instead of grouping them", () => {
    const mastery = new Map([[1, 0.2], [2, 0.4]]);
    const due = [
      card(1, [1]), card(2, [1]), card(3, [1]),
      card(4, [2]), card(5, [2]), card(6, [2]),
    ];
    expect(ids(buildQueue(due, mastery, NOW))).toEqual([1, 4, 2, 5, 3, 6]);
  });

  it("applies the limit before interleaving, keeping the highest-priority cards", () => {
    const mastery = new Map([[1, 0.1], [2, 0.9]]);
    const due = [card(1, [1]), card(2, [1]), card(3, [2]), card(4, [2])];
    const result = buildQueue(due, mastery, NOW, 2);
    expect(ids(result).sort()).toEqual([1, 2]); // both from the weak pattern
  });

  it("handles cards with no patterns", () => {
    const result = buildQueue([card(1, []), card(2, [])], new Map(), NOW);
    expect(result).toHaveLength(2);
  });

  it("does not modify its inputs", () => {
    const due = [card(2, [2]), card(1, [1])];
    const copy = due.map((c) => ({ ...c }));
    buildQueue(due, new Map([[1, 0.1]]), NOW);
    expect(due).toEqual(copy);
  });

  it("is deterministic", () => {
    const due = Array.from({ length: 8 }, (_, i) => card(i + 1, [(i % 3) + 1]));
    expect(ids(buildQueue(due, new Map(), NOW))).toEqual(ids(buildQueue(due, new Map(), NOW)));
  });
});
