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
`uvicorn main:app --reload --host 0.0.0.0 --port 8000`. No separate migration
command is needed for the initial schema; startup creates missing tables.
