/**
 * Builds today's revision queue.
 * Pure function: weak patterns and overdue cards first, then interleaved.
 */

export interface DueCard {
  id: number;
  patternIds: number[]; // a problem can belong to several patterns
  dueAt: Date;
}

export const DEFAULT_DAILY_LIMIT = 10;
export const DEFAULT_MASTERY = 0.5; // for patterns we have no data on
export const WEAKNESS_WEIGHT = 0.6;
export const OVERDUE_WEIGHT = 0.4;
export const MAX_OVERDUE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
const NO_PATTERN = -1;

/** The card's weakest pattern: the one we most need to practise. */
function weakestPattern(
  card: DueCard,
  mastery: Map<number, number>
): { patternId: number; mastery: number } {
  if (card.patternIds.length === 0) {
    return { patternId: NO_PATTERN, mastery: DEFAULT_MASTERY };
  }
  let best = { patternId: card.patternIds[0], mastery: Infinity };
  for (const id of card.patternIds) {
    const m = mastery.get(id) ?? DEFAULT_MASTERY;
    if (m < best.mastery || (m === best.mastery && id < best.patternId)) {
      best = { patternId: id, mastery: m };
    }
  }
  return best;
}

export function buildQueue(
  due: DueCard[],
  mastery: Map<number, number>,
  now: Date = new Date(),
  limit: number = DEFAULT_DAILY_LIMIT
): DueCard[] {
  // 1. Score every card.
  const scored = due.map((card) => {
    const weakest = weakestPattern(card, mastery);
    const overdueDays = Math.max(0, (now.getTime() - card.dueAt.getTime()) / DAY_MS);
    const overdueFactor = Math.min(overdueDays, MAX_OVERDUE_DAYS) / MAX_OVERDUE_DAYS;
    const priority = WEAKNESS_WEIGHT * (1 - weakest.mastery) + OVERDUE_WEIGHT * overdueFactor;
    return { card, patternId: weakest.patternId, priority };
  });

  // 2. Highest priority first. Ties broken by id so results are deterministic.
  scored.sort((a, b) => b.priority - a.priority || a.card.id - b.card.id);

  // 3. Keep only today's share.
  const top = scored.slice(0, Math.max(0, limit));

  // 4. Group by pattern. Map keeps insertion order, so the group holding
  //    the highest-priority card comes first.
  const groups = new Map<number, DueCard[]>();
  for (const s of top) {
    const list = groups.get(s.patternId) ?? [];
    list.push(s.card);
    groups.set(s.patternId, list);
  }

  // 5. Deal one card from each group in turn (round-robin).
  const result: DueCard[] = [];
  const lists = [...groups.values()];
  while (result.length < top.length) {
    for (const list of lists) {
      const next = list.shift();
      if (next) result.push(next);
    }
  }
  return result;
}
