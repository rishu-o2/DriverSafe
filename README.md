# DriverSafe

DriverSafe is a browser camera dashboard backed by a FastAPI service. The browser extracts normalized facial features with MediaPipe and sends them to the backend over an authenticated WebSocket. The backend applies the trained NumPy models and temporal rules, stores alert episodes and labeled feature recordings in PostgreSQL, and serves per-user metrics and exports. Camera images and video are not uploaded or stored.

## Local development

Install frontend dependencies from the repository root with `pnpm install`. Install the backend dependencies with `pip install -r backend/requirements.txt`. Configure `DATABASE_URL` and `SECRET_KEY` in your local backend environment, then run `python init_db.py` from `backend/` once, and start FastAPI with `uvicorn main:app --reload --host 0.0.0.0 --port 8000`. Set the frontend `VITE_API_URL` only when the API is not served at the same origin. `VITE_WS_URL` similarly overrides the WebSocket origin.

## Vercel deployment

Use **one Vercel project** connected to this repository, with **Root Directory `.`** and **Framework Preset `Services`**. The root [vercel.json](vercel.json) defines a FastAPI backend service and Vite frontend service on the same deployment origin. `/api/*` routes to FastAPI; all other paths route to the frontend. Set Vercel's framework to Services so Vercel processes this services configuration. Vercel currently documents Services as a beta/limited-availability feature; confirm it is enabled for the account before relying on this deployment design.

The frontend service installs with `cd .. && pnpm install --frozen-lockfile` and builds with `cd .. && pnpm --filter @workspace/driversafe run build`. The backend service builds with `python build.py`; Vercel uses `backend/app.py` as its FastAPI entrypoint. Configure the backend dependencies and model artifacts in the backend service root as defined by the root config.

Set these backend environment variables in the Vercel project:

- Required: `DATABASE_URL`, `SECRET_KEY`
- Cookie and origin policy: `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, `AUTH_COOKIE_DOMAIN`, `FRONTEND_ORIGINS`
- Optional runtime tuning: `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CALIBRATION_SECONDS`, `ALERT_COOLDOWN_SECONDS`, `RECORDING_STEP_CALIBRATION_SECONDS`, `RECORDING_STEP_NORMAL_SECONDS`, `RECORDING_STEP_DROWSY_EYES_SECONDS`, `RECORDING_STEP_DROWSY_YAWN_SECONDS`, `RECORDING_STEP_DROWSY_NOD_SECONDS`
- Vercel supplies `VERCEL_URL`, `VERCEL_BRANCH_URL`, and `VERCEL_PROJECT_PRODUCTION_URL`; the backend adds these exact HTTPS hosts to the origin allow-list.

For this same-origin deployment, use `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=lax`, and leave `AUTH_COOKIE_DOMAIN` empty. Do not set `VITE_API_URL` or `VITE_WS_URL`; both default to the deployment's same origin. The optional Firebase configuration names are `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`, and `VITE_ENABLE_ANALYTICS` (defaults off).

Use a PostgreSQL database such as Neon or Supabase. Run `python init_db.py` once from `backend/` with `DATABASE_URL` set to the provider's **pooled** PostgreSQL connection string and TLS enabled with `sslmode=require`. The application also creates missing tables and applies the additive alert episode migration once per process on first database access; run the initializer before deployment to avoid concurrent cold-start setup. `/api/health` reports the database query result without returning connection details.

Vercel Functions limit a live WebSocket to the configured function duration (currently 300 seconds in this project), and reconnects can reach another instance. Live tracking state remains in process memory, so a camera session is not reliable across reconnects or instances. For dependable live sessions, host the backend on a persistent service such as Render, Railway, or Fly.io, or move live session state to a shared store and design reconnect recovery. This repository does not silently switch the backend host.

## Authentication and data

Signup, login, current-user lookup, and logout are under `/api/auth`. Detection, clustering, metrics, alert history, CSV export, and recordings require the HttpOnly authentication cookie. Each user's live session and database rows are isolated by their user ID. The synthetic feed is authenticated and identifies responses with `source: "synthetic"`.

The recording API stores derived 20-value feature vectors and labels, not image/video data. It requires consent and provides per-user list, export, and delete endpoints. Offline evaluation can replay the authenticated account's recorded features with `python -m evaluation.evaluate` from `backend/`; evaluation results are written beneath `backend/evaluation/results/`.

## Verification

Run backend tests from `backend/` with `python -m unittest discover -s tests -v`. Run the frontend checks from the repository root with `pnpm --filter @workspace/driversafe run typecheck` and `pnpm --filter @workspace/driversafe run build`.
