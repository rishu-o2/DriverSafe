# DriverSafe architecture

## Demo scope

DriverSafe is a public React/TypeScript Vite frontend and Python FastAPI backend. The demo has no accounts and no database. Every visitor handled by one backend process uses the same in-memory session, including alert history, calibration, cooldown, and live metrics. **Demo: history resets on restart.** Vercel may run more than one backend instance; each instance has its own in-memory state.

The browser uses MediaPipe to extract 20 normalized facial features from a camera stream. It sends feature vectors, never camera images or video, to the backend. If camera access, MediaPipe, or the WebSocket is unavailable, the dashboard sends generated features; responses identify that path with `source: "synthetic"` and the UI shows `source: synthetic`.

## Runtime flow

- `frontend/src/pages/dashboard.tsx` owns the camera lifecycle and dashboard presentation.
- `frontend/src/lib/face-landmarks.ts` converts MediaPipe face landmarks into the 20-value feature vector.
- `frontend/src/hooks/useApi.ts` maintains the WebSocket, falls back to `/api/detection/demo/frame`, and collects dashboard metrics and episodes.
- `backend/routers/detection.py` loads the compact NumPy artifacts in `backend/saved_models/`, validates input, performs inference, calibration, and temporal eye/yawn checks, combines three model decisions with a 2-of-3 vote, applies episode/cooldown logic, and returns JSON-safe events.
- `backend/utils/live_session.py` stores shared process-local calibration, features, rolling metrics, and up to 100 alert episodes.
- `backend/routers/alerts.py` exposes in-memory history, stats, and CSV export. `backend/routers/metrics.py` and `backend/routers/clustering.py` expose model and session metrics and clustering.
- `backend/evaluation/` contains offline evaluator scripts and unit tests. The evaluator reads JSONL feature exports placed under `backend/evaluation/recordings/`; results go to `backend/evaluation/results/`.

## API and origins

Public routes include `/api/health`, `/api/detection/status`, `/api/detection/demo/frame`, `/api/detection/ws`, `/api/alerts/*`, `/api/metrics/*`, and `/api/cluster/*`. No route requires a user, cookie, token, or database. Health reports `{ "status": "ok", "mode": "in-memory-demo" }`.

Vercel serves frontend and backend on one deployment origin, so browser API calls and WebSocket handshakes are same-origin. Local Vite proxies `/api` and WebSocket traffic to `127.0.0.1:8000`. The backend CORS middleware allows only the two local Vite origins for direct development access; no configurable Origin allow-list is needed.

## Vercel deployment

Use the repository root (`.`) as Root Directory and `Services` as Framework Preset. Root `vercel.json` defines a FastAPI backend and Vite frontend and rewrites `/api/*` to the backend, with other paths sent to the frontend. No environment variables are required. The Vercel Services framework is in beta. WebSocket support on Vercel uses Fluid Compute; connections can close at the configured function duration, and the client reconnects.

## Tests and local development

From `backend/`, run `python -m unittest discover -s tests` for backend tests. From the repository root, run `pnpm --filter @workspace/driversafe run typecheck` and `pnpm --filter @workspace/driversafe run build`.

For a local run, start `uvicorn main:app --reload --host 127.0.0.1 --port 8000` from `backend/`, then run `pnpm --filter @workspace/driversafe run dev` from the repository root. Open `http://localhost:5173`; no environment variables or database initialization are needed.
