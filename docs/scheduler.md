# Scheduler

PrepDebt uses the SM-2 algorithm to decide when to show each problem again.

## Ratings

| Button | Rating | Effect |
|---|---|---|
| Forgot | 1 | Interval resets to 1 day, ease -0.2, lapse counted |
| Hard | 2 | Interval grows, ease -0.14 |
| Good | 3 | Interval grows, ease unchanged |
| Easy | 4 | Interval grows faster, ease +0.1 |

## Interval rules

1. First success: 1 day
2. Second success: 6 days
3. After that: `previous interval x ease` (at least +1 day)

Ease starts at 2.5 and never goes below 1.3.

## Design decision

The scheduler is a pure function (`backend/src/scheduler/sm2.ts`). It has no database or clock access, so it is unit tested without any setup.

(Pattern-weighted queue and simulation results will be added in later phases.)