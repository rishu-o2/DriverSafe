from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import alerts, clustering, detection, metrics


@asynccontextmanager
async def lifespan(app: FastAPI):
    detection.load_models()
    yield


app = FastAPI(title="DriverSafe API", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(detection.router, prefix="/api/detection", tags=["detection"])
app.include_router(clustering.router, prefix="/api/cluster", tags=["clustering"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["metrics"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])


@app.get("/")
def read_root():
    return {"status": "DriverSafe API is running"}


@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "ok", "mode": "in-memory-demo"}
