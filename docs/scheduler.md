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
## Pattern mastery

`backend/src/scheduler/mastery.ts` scores each pattern from 0 to 1 using a recency-weighted average of review ratings.

| Rating | Score |
|---|---|
| Forgot | 0 |
| Hard | 0.5 |
| Good | 0.85 |
| Easy | 1 |

- A review's weight halves every 14 days, so recent performance matters most.
- A neutral prior (score 0.5, weight 1) keeps one review from swinging the score to an extreme.

## Daily queue

`backend/src/scheduler/queue.ts` builds the list of problems to revise today.

1. Priority = `0.6 x (1 - mastery of the card's weakest pattern) + 0.4 x overdue factor` (days overdue, capped at 14, divided by 14).
2. Keep the top N cards (default 10) so the daily load stays manageable.
3. Interleave: group by pattern and deal round-robin, so the same pattern is not shown repeatedly in a row.

## Limitations

The weights (0.6 / 0.4), the half-life (14 days) and the rating scores are reasonable starting values, not measured ones. The simulation in a later phase will compare this strategy against random and plain SM-2 revisiting, and real user data will show whether the values need changing.

## Simulation

`simulation/` compares three ways of choosing the day's reviews on a synthetic learner: random revisiting, plain SM-2 (most overdue first) and the pattern-weighted queue. It imports the real scheduler modules from `backend/src/scheduler`. Run it with `npm run sim` inside `simulation/`.

Full numbers and charts: [simulation-results.md](simulation-results.md).

### What the model assumes

- Memory decays exponentially, `exp(-days / stability)`. Successful reviews grow stability, failures shrink it, and patterns differ in difficulty.
- **Transfer (an assumption):** reviewing any problem in a pattern raises a skill that makes every problem in that pattern easier to remember. Pattern weighting can only help if something like this is true, so one scenario assumes it and another assumes none.
- The learner's rating is derived from the recall probability. Real people rate themselves with noise.
- Every strategy gets the same daily review limit and the same starting problems.

### Findings

(Write 3-4 sentences here from YOUR results. State the size of the difference and the seed count, say what happened in the no-transfer scenario, and say plainly that this is a simulation and the real test is the classmate pilot.)

### Limitations

The learner model is a simplification, the parameters (growth factors, skill gain, pattern difficulty) are chosen by hand rather than fitted to data, and ratings are not noisy. The simulation cannot show that PrepDebt helps real students. It only shows how the strategies behave under these assumptions.
