# Frontend

React + TypeScript + Vite, with React Router.

## Structure

- `src/api/client.ts`: one `fetch` wrapper. Adds the token, turns the backend's error shape into an `ApiError`, and clears the session on a 401.
- `src/auth/`: auth context (session in `localStorage`) and a provider with `login`, `register` and `logout`.
- `src/components/RequireAuth.tsx`: route guard. Unauthenticated users are redirected to `/login`.
- `src/pages/`: Login/Register, Today (loading, error, empty and list states) and Review.

## Development

The Vite dev server proxies `/api/*` to `http://localhost:4000`, so there are no CORS issues locally. In production, set `VITE_API_URL` to the deployed backend.

## Decisions

- The token is kept in `localStorage`. This is simple, but readable by any script on the page (XSS). A production-hardened version could use an httpOnly cookie instead.
- No global state library: the only shared state is the session, so React context is enough.
- Every data-fetching screen handles loading, error and empty states.

## Review flow

`src/pages/Review.tsx` runs a small state machine per card: `recall` -> `reveal` -> `rated`.

1. **recall:** only the title and patterns are shown. The user writes their approach from memory.
2. **reveal:** the saved notes are fetched (`GET /cards/:id`) and shown beside what the user just wrote.
3. **rated:** the rating is sent (`POST /reviews`) with the time spent, and the next interval is shown.

The recall text is deliberately not sent to the server. It exists so the user can compare it with their notes. Notes are fetched only after the recall step, so they can't be seen before the user tries to remember.

## Add and import

- `AddProblemForm` loads patterns from the API, so the choices always match the database.
- `CsvImport` reads the file in the browser and sends it as `text/csv`. The server reports imported, skipped and failed rows, and the page shows the failed rows with their row numbers.

## Insights page

`src/pages/Insights.tsx` loads `/stats/patterns` and `/stats/overview` together and shows summary tiles, weakest and strongest patterns, a mastery bar chart and an upcoming-load chart (Recharts).

- Patterns with no reviews are drawn grey, because their mastery is only the neutral prior (0.5), which would be misleading as a real score.
- Weakest and strongest lists only include patterns with at least one review.
- Chart colours use the same CSS variables as the rest of the app, so light and dark mode both work.
