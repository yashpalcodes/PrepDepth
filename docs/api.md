# API

All routes except `/health` and `/auth/*` need the header `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| POST | /auth/register | Create account, returns token |
| POST | /auth/login | Log in, returns token |
| GET | /patterns | List pattern names |
| POST | /problems | Add a solved problem (patterns, optional note, `firstReviewInDays`) |
| GET | /problems | List your problems |
| GET | /queue/today | Pattern-weighted, interleaved list (`?limit=` 1-50, default 10) |
| POST | /reviews | Rate a card (1 Forgot, 2 Hard, 3 Good, 4 Easy) |

## Design notes

- Routes only handle HTTP and SQL. Scheduling logic lives in `backend/src/scheduler` as pure functions.
- Reviewing a card runs in one transaction with a row lock, so the card update and the review log can't get out of sync.
- Passwords are hashed with bcrypt. Login returns the same error for an unknown email and a wrong password.
- Inputs are validated with Zod, and errors use one consistent JSON shape.
