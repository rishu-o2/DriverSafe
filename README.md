# DriverSafe

AI-powered driver safety monitoring system.

- **Frontend**: [driversafe.vercel.app](https://driversafe.vercel.app)
- **Backend**: FastAPI

## Backend database setup

The API creates the `users` table from its SQLAlchemy model when the FastAPI
application starts. Set `DATABASE_URL` in `backend/.env` to a PostgreSQL URL
for deployments. For local development, it may instead point to a SQLite file,
for example `sqlite:///./driversafe.db`. Vercel deployments reject SQLite
because its filesystem is not persistent.

Live detection calibrates each authenticated user's first face session for
`CALIBRATION_SECONDS` of accepted face-frame time (default `30`, allowed
`30`–`60`). Accepted calibration
frames must contain finite 20-value features in range, open eyes, and a mostly
closed mouth; outliers are excluded. At least 100 accepted frames are required
in addition to the configured duration. Calibration stores per-user means and
standard deviations in the in-memory live session and adjusts only the eye and
mouth rule thresholds within fixed safe bounds. The trained models are not
changed. Calibration and temporal tracker state survive WebSocket reconnects.
An open episode remains open for a 30-second reconnect grace period, then is
closed and saved if no reconnect occurs. Other session state expires after 30
minutes of inactivity and is lost on a backend restart.

`ALERT_COOLDOWN_SECONDS` defaults to `30` and must be non-negative. The backend
stores one alert-history row per contiguous drowsy episode with its start time,
end time, and peak confidence as severity. Episodes inside the cooldown are
still stored, but their `alert_event` flag is false so clients can suppress a
repeated notification. A non-drowsy or missing-face frame closes an episode.
Set `FRONTEND_ORIGINS` to a comma-separated list of exact browser origins that
should be allowed to make credentialed API requests; it defaults to
`FRONTEND_URL` and then `https://driversafe.vercel.app`.

Cookie settings are `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`, and
`AUTH_COOKIE_DOMAIN`. For local `http://localhost:5173` development, use:

```text
FRONTEND_ORIGINS=http://localhost:5173
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAMESITE=lax
AUTH_COOKIE_DOMAIN=
```

For production with `app.driversafe.com` and `api.driversafe.com`, use:

```text
FRONTEND_ORIGINS=https://app.driversafe.com
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=lax
AUTH_COOKIE_DOMAIN=
```

If using separate-site Vercel hostnames, use `AUTH_COOKIE_SECURE=true` and
`AUTH_COOKIE_SAMESITE=none`. Leave the cookie domain empty unless it must be
shared across subdomains.

Live detection state is keyed by the authenticated user ID and kept in process
memory. Each user's state expires after 30 minutes without activity and idle
entries are removed the next time live state is accessed. The store is capped at
1,000 users. This is for a single backend instance only: a restart clears live
state, and multiple instances would keep separate copies. No shared state
service is configured.

`backend/vercel.json` routes the FastAPI app through `app.py` and sets
`maxDuration` to 300 seconds. Vercel supports WebSockets in Functions, including
FastAPI, but each connection closes at its function duration and reconnects may
land on another instance. The in-memory live state is therefore suitable only
for a single-instance demo; it is not reliable on Vercel when requests can reach
different instances. Ensure Fluid Compute is enabled for older Vercel projects.

Install backend dependencies with `pip install -r backend/requirements.txt`,
then start the API from the `backend` directory with
`uvicorn main:app --reload --host 0.0.0.0 --port 8000`. Startup creates missing
tables and applies the additive alert episode columns to an existing `alerts`
table; no data is deleted. The migration runs automatically on app startup.
