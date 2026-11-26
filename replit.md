# DriverSafe

DriverSafe is a public, account-free drowsiness detection demo. It has no database or required environment variables. See [README.md](README.md) for local development and Vercel deployment.

The React dashboard uses camera landmarks when available and labels generated input as `source: synthetic`. The FastAPI service runs the three models, calibration, 2-of-3 vote, temporal rules, episode cooldown, clustering, and metrics. Alert history and session statistics are shared in memory and reset when the backend restarts.
