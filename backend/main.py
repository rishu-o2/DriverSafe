from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

from routers import detection, clustering, metrics, alerts
from utils.security import get_allowed_origins, is_allowed_origin


@asynccontextmanager
async def lifespan(app: FastAPI):
    detection.load_models()
    yield


app = FastAPI(title="DriverSafe API", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
origins = get_allowed_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def validate_mutation_origin(request: Request, call_next):
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin", "")
        if not origin or not is_allowed_origin(
            origin,
            request.headers.get("x-forwarded-host") or request.headers.get("host", ""),
            request.headers.get("x-forwarded-proto"),
        ):
            return JSONResponse(status_code=403, content={"detail": "Origin not allowed"})
    return await call_next(request)


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
    return {"status": "ok"}
