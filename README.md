# DriverSafe

DriverSafe is a public, account-free drowsiness detection demo. The browser extracts 20 normalized facial features from a real camera feed with MediaPipe; if the camera or WebSocket is unavailable, a clearly labeled synthetic feed demonstrates the pipeline. The backend runs three NumPy models (autoencoder, isolation forest, and LOF), uses a 2-of-3 model vote alongside temporal eye and yawn rules, calibrates the driver's baseline, and tracks alert episodes with cooldown. Live metrics, alert history, and clustering use one shared in-memory demo session. **Demo: history resets on restart.** Camera images and video are not uploaded or stored.

## Local run

Install dependencies once from the repository root:

```powershell
pnpm install
python -m venv .venv
..\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

Run the backend from `backend/` in one terminal:

```powershell
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Run the frontend from the repository root in a second terminal:

```powershell
pnpm --filter @workspace/driversafe run dev
```

Open `http://localhost:5173`. Vite proxies `/api` and the detection WebSocket to the local backend; no environment variables or database setup are needed. Check `http://localhost:5173/api/health` for `{"status":"ok","mode":"in-memory-demo"}`.

## Vercel deployment

Use one Vercel project connected to this repository:

- Root Directory: `.`
- Framework Preset: `Services`
- Build and Development settings: use the repository `vercel.json` configuration
- Environment Variables: none

The Services preset is currently in beta and may need to be enabled for the Vercel account. The root config builds the FastAPI backend and Vite frontend as same-origin services, routes `/api/*` to FastAPI, and sends other paths to the frontend. No database, secrets, cookies, or custom Origin list are required. Vercel WebSocket support requires Fluid Compute; the client reconnects if a function duration ends.

### Deployment smoke test

1. Open `https://<your-deployment>/api/health`. It should return `{"status":"ok","mode":"in-memory-demo"}`.
2. Open `https://<your-deployment>/` and choose **Open demo dashboard**. The dashboard should load without signing in.
3. Block camera access in the browser (or use a device without a camera). The dashboard switches to the generated feed and shows `source: synthetic`.
4. Leave the synthetic feed running until its drowsy segment. A drowsy episode should appear in the dashboard alert history.
5. To verify the WebSocket payload, open the browser DevTools Console on the deployed site and run:

   ```js
   const ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/detection/ws`);
   let sent = 0;
   ws.onmessage = ({ data }) => {
     const frame = JSON.parse(data);
     if (frame.episode_event) console.log("episode over WebSocket", frame.source, frame.episode_event);
   };
   ws.onopen = () => {
     const timer = setInterval(() => {
       ws.send(JSON.stringify({ synthetic: true }));
       if (++sent >= 100) clearInterval(timer);
     }, 100);
   };
   ```

   The console should print an `episode over WebSocket` entry with `source` set to `synthetic`. History and metrics are process-local and reset on backend restart.

## Demo behavior

- Open `/dashboard` and allow camera access for real detection, or use the generated synthetic feed when the camera is unavailable. The dashboard labels the generated feed `source: synthetic`.
- Synthetic frames are generated server-side and exercise the same three-model and temporal-rule path. If the camera is unavailable, the dashboard automatically uses the generated feed. A drowsy interval appears during the deterministic demo sequence.
- Calibration is kept for real camera frames. The synthetic stream is labeled ground truth and bypasses calibration so it can demonstrate detection immediately.
- Alert episodes are available from `/api/alerts/history` and are sent in each WebSocket response as `episode_event`. Alert history and metrics exist only in backend process memory and reset when that process restarts; multiple visitors share the demo state.

## Evaluation

The offline evaluator and unit tests remain under `backend/evaluation`. To evaluate recordings exported as newline-delimited JSON from the full-auth branch, place `*.jsonl` files in `backend/evaluation/recordings/` and run from `backend/`:

```powershell
python -m evaluation.evaluate
python -m unittest evaluation.test_metrics
```

The evaluator uses the deployed inference code and writes generated reports to `backend/evaluation/results/`.

## Verification

```powershell
cd backend
python -m unittest discover -s tests
cd ..
pnpm --filter @workspace/driversafe run typecheck
pnpm --filter @workspace/driversafe run build
```

See [PROJECT_ARCHITECTURE.md](PROJECT_ARCHITECTURE.md) for the system layout and data flow.
