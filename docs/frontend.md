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
