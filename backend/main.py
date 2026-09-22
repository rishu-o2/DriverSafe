from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, detection, clustering, metrics, alerts
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="DriverSafe API")

origins = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(detection.router, prefix="/api/detection", tags=["detection"])
app.include_router(clustering.router, prefix="/api/cluster", tags=["clustering"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["metrics"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])

@app.get("/")
def read_root():
    return {"status": "DriverSafe API is running"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
