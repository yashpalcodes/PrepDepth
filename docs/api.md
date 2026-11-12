# API

All routes except `/health` and `/auth/*` need the header `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| POST | /auth/register | Create account, returns token |
| POST | /auth/login | Log in, returns token |
| GET | /patterns | List pattern names |
| POST | /problems | Add a solved problem (patterns, optional note, `firstReviewInDays`) |
| GET | /problems | List your problems |
| GET | /cards/:id | One card with its saved notes (called after the user writes their recall) |
| GET | /queue/today | Pattern-weighted, interleaved list (`?limit=` 1-50, default 10) |
| POST | /reviews | Rate a card (1 Forgot, 2 Hard, 3 Good, 4 Easy) |
| GET | /stats/patterns | Mastery per pattern, weakest first |
| POST | /import/csv | Bulk import (`Content-Type: text/csv`, max 500 rows) |

## CSV format

title,difficulty,patterns,platform,external_id,url,approach,insight,first_review_in_days

Required: `title`, `difficulty` (easy/medium/hard), `patterns` (separate several with `;`). Everything else is optional. Without `first_review_in_days`, first reviews are spread across 7 days so the queue stays manageable.

The response lists `imported`, `skipped` (already in your list) and `errors` (with row numbers). A bad row never blocks the good ones.

## Design notes

- Routes handle HTTP and SQL. Scheduling logic lives in `backend/src/scheduler` as pure functions; shared queries live in `backend/src/services`.
- Reviewing a card runs in one transaction with a row lock, so the card update and the review log can't get out of sync.
- Passwords are hashed with bcrypt. Login returns the same error for an unknown email and a wrong password.
- Inputs are validated with Zod, and errors use one consistent JSON shape.
- Tests run against a separate `prepdebt_test` database that is created, migrated and seeded automatically.

## GET /stats/overview

Returns the numbers behind the Insights page:

| Field | Meaning |
|---|---|
| `totalCards` | Active problems |
| `dueNow` | Cards due now |
| `later` | Cards due more than 14 days away |
| `reviews7d` | Reviews in the last 7 days |
| `reviews30d` | Reviews in the last 30 days |
| `recallRate30d` | Share of reviews rated Hard or better in 30 days, or `null` with no reviews |
| `days` | 14 entries `{day, count}`: cards due in each rolling 24-hour window from now |

`recallRate30d` is self-reported (the user rates their own recall), so it measures how often people believe they remembered, not an objective test score.
