# DriverSafe project architecture

## Runtime overview

DriverSafe is a React/TypeScript Vite application and a Python FastAPI service in one pnpm monorepo. The frontend uses MediaPipe in the browser to derive 20 normalized facial features; it sends features and synthetic test frames to FastAPI and renders the returned scores and state. Inference, input validation, authentication, persistence, and security are backend responsibilities. Camera images and video are not sent to the backend.

```text
Browser (React, MediaPipe)
  ├─ HTTPS /api/* ──> FastAPI routers ──> PostgreSQL
  └─ WSS /api/detection/ws ──> per-user in-process live tracker
```

## Backend components

- `backend/main.py` creates the FastAPI app, applies credentialed CORS and mutation-origin checks, mounts routers, and exposes `/health` and database-checking `/api/health`.
- `backend/routers/auth.py` handles signup, login, current user, and logout. The JWT is stored only in an HttpOnly cookie. `get_current_user` validates it and loads the user.
- `backend/routers/detection.py` serves authenticated detection status and synthetic HTTP frames, validates the WebSocket cookie and Origin, processes live feature frames, and stores episode start/end data.
- `backend/routers/clustering.py` and `live_clustering.py` provide static dataset and account-scoped live clustering.
- `backend/routers/metrics.py` returns offline model metrics and account-scoped in-memory session metrics.
- `backend/routers/alerts.py` lists, summarizes, and exports alert episodes filtered by user ID.
- `backend/routers/recordings.py` handles consented labeled feature recordings, metadata, JSONL export, and deletion filtered by user ID.
- `backend/database.py` defines SQLAlchemy user, alert, and recording tables. It creates the schema and runs the additive alert episode column migration once per process on first database access.
- `backend/init_db.py` runs the same schema setup as a one-time deployment command.
- `backend/utils/live_session.py` owns bounded in-process trackers, calibration state, and recent metrics keyed by user ID. This state is instance-local and ephemeral.
- `backend/evaluation/` replays stored feature recordings through the detector and generates offline evaluation reports.

Protected API families are `/api/detection/*`, `/api/cluster/*`, `/api/metrics/*`, `/api/alerts/*`, and `/api/recordings/*`. Signup and login are public; `/api/auth/me` and logout require a valid cookie. `/health` and `/api/health` are public. The synthetic source is marked `source: "synthetic"` and uses the authenticated account's session.

## Data and security

PostgreSQL stores accounts, alert episodes, recording sessions, and labeled feature rows. It does not store face images or video. Alert and recording queries include the authenticated user's ID. Auth cookies use `SameSite=lax`, `Secure` in production, `HttpOnly`, path `/`, and no domain for the selected same-origin deployment. Mutation Origins must match `FRONTEND_ORIGINS`, an exact Vercel-provided deployment host, or the request host under the expected scheme. Rejected origins are logged with Origin and Host only.

`DATABASE_URL` and `SECRET_KEY` are required. Vercel requires PostgreSQL; SQLite is intended for local development and tests only. Missing or invalid settings fail with log messages naming the variable without logging its value. `/api/health` runs `SELECT 1` and returns the database status without connection details.

## Frontend

`frontend/src/App.tsx` routes signup and login pages and checks `/api/auth/me` before displaying dashboard routes. `frontend/src/lib/api.ts` sends credentialed HTTP requests, reports API error details and status codes, and chooses the HTTP and WebSocket origins from `VITE_API_URL` and `VITE_WS_URL` with same-origin fallbacks. The dashboard displays API data and provides logout. Firebase settings are read from `VITE_FIREBASE_*`; analytics requires `VITE_ENABLE_ANALYTICS=true`.

## Deployment

Use one Vercel project with repository Root Directory `.` and Framework Preset `Services`. Root `vercel.json` defines `backend` and `frontend` services. Its ordered public rewrites send `/api/*` to FastAPI and all other routes to the Vite app. `frontend/vercel.json` is removed; `backend/vercel.json` is neutralized so the root config is authoritative. The Vercel Services configuration currently has limited/beta availability, which must be enabled for the project.

Configure `DATABASE_URL` using the database provider's pooled PostgreSQL URL with `sslmode=require`, set `SECRET_KEY`, and use `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=lax`, and an empty `AUTH_COOKIE_DOMAIN`. `FRONTEND_ORIGINS` may list additional exact origins. Vercel's `VERCEL_URL`, `VERCEL_BRANCH_URL`, and `VERCEL_PROJECT_PRODUCTION_URL` are added as exact HTTPS origins. Do not configure `VITE_API_URL` or `VITE_WS_URL` for same-origin routing.

Run `python init_db.py` from `backend/` against production PostgreSQL before deployment. Application startup also ensures tables for serverless cold starts. The frontend service installs with `cd .. && pnpm install --frozen-lockfile` and builds with `cd .. && pnpm --filter @workspace/driversafe run build`; the backend service runs `python build.py` and uses `app.py` as its FastAPI entrypoint.

Vercel Functions cap WebSocket lifetime at the configured `maxDuration` (300 seconds here), and a reconnect may land on a different instance. Since live state is process-local, Vercel Functions do not provide reliable continuity for a live camera session. Use a persistent backend host or add a shared live-state store and reconnect protocol for reliable sessions.

## Verification commands

From `backend/`, run `python -m unittest discover -s tests -v`. From the repository root, run `pnpm --filter @workspace/driversafe run typecheck` and `pnpm --filter @workspace/driversafe run build`.
