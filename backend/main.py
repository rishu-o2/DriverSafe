from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

from database import Base, engine, migrate_alert_episode_columns
from routers import auth, detection, clustering, metrics, alerts
from utils.security import get_allowed_origins


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_alert_episode_columns()
    detection.load_models()
    yield


app = FastAPI(title="DriverSafe API", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
origins = get_allowed_origins()
allowed_origins = frozenset(origins)

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
        origin = request.headers.get("origin", "").rstrip("/")
        if not origin or origin not in allowed_origins:
            return JSONResponse(status_code=403, content={"detail": "Origin not allowed"})
    return await call_next(request)


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(detection.router, prefix="/api/detection", tags=["detection"], dependencies=[Depends(auth.get_current_user)])
app.include_router(clustering.router, prefix="/api/cluster", tags=["clustering"], dependencies=[Depends(auth.get_current_user)])
app.include_router(metrics.router, prefix="/api/metrics", tags=["metrics"], dependencies=[Depends(auth.get_current_user)])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"], dependencies=[Depends(auth.get_current_user)])


@app.get("/", dependencies=[Depends(auth.get_current_user)])
def read_root():
    return {"status": "DriverSafe API is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
