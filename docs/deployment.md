# Deployment

Everything runs on free-tier-friendly managed services.

| Part | Service | Notes |
|---|---|---|
| Database | Neon (Postgres) | Migrations and seed are run from a developer machine with `DATABASE_URL` set |
| Backend | Vercel (serverless function) | Root `backend`, `api/index.ts` re-exports the Express app, `vercel.json` rewrites all paths to it |
| Frontend | Vercel (static) | Root `frontend`, `VITE_API_URL` points at the backend, `vercel.json` rewrites all paths to `index.html` |

## Environment variables

| Project | Key | Purpose |
|---|---|---|
| Backend | `DATABASE_URL` | Neon connection string (pooled) |
| Backend | `JWT_SECRET` | Signs login tokens. Long, random, different from local |
| Backend | `CORS_ORIGIN` | The frontend URL allowed to call the API |
| Backend | `DB_POOL_MAX` | Connections per function instance (3) |
| Frontend | `VITE_API_URL` | Backend base URL. Baked in at build time, so changing it needs a redeploy |

Secrets live only in Vercel's environment settings. `.env` is git-ignored and `.env.example` documents the keys.

## Applying a schema change

1. Add `backend/src/db/migrations/00N_name.sql`.
2. Run `DATABASE_URL='<neon string>' npm run migrate` from `backend/` before deploying code that needs it.

## Serverless trade-offs

- Each function instance has its own memory, so the auth rate limiter counts per instance rather than globally. It still slows down repeated login attempts, but it is not a strict global limit. A shared store (for example Redis) would fix this.
- Instances open their own database connections, so the pool is kept small and Neon's pooled connection string is used.
- The first request after a quiet period is slower (cold start).
- The JWT is stored in `localStorage` (readable by any script on the page). An httpOnly cookie would be safer.
