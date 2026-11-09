import os

from dotenv import load_dotenv
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

raw_database_url = os.getenv("DATABASE_URL")
if not raw_database_url:
    raise RuntimeError("DATABASE_URL must be set before starting the backend")

def normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgres://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgres://")
    if database_url.startswith("postgresql://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgresql://")
    return database_url


DATABASE_URL = normalize_database_url(raw_database_url)

if (os.getenv("VERCEL") or os.getenv("VERCEL_ENV")) and DATABASE_URL.startswith("sqlite"):
    raise RuntimeError("DATABASE_URL must use PostgreSQL in the Vercel production environment")

engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(320), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    end_timestamp = Column(DateTime(timezone=True), nullable=True)
    peak_severity = Column(Float, nullable=False, default=0.0)
    frame = Column(Integer, nullable=False)
    state = Column(String(50), nullable=False)
    ae_error = Column(Float, nullable=False, default=0.0)
    if_score = Column(Float, nullable=False, default=0.0)
    lof = Column(Float, nullable=False, default=0.0)
    confidence = Column(Float, nullable=False, default=0.0)
    models = Column(JSON, nullable=False, default=list)
    votes = Column(Integer, nullable=False, default=0)
    model_alerts = Column(JSON, nullable=False, default=dict)
    live_signals = Column(JSON, nullable=False, default=dict)


def migrate_alert_episode_columns():
    """Add episode fields to an existing alerts table; safe to run at startup."""
    if not inspect(engine).has_table("alerts"):
        return

    column_types = {
        "end_timestamp": DateTime(timezone=True),
        "peak_severity": Float(),
    }
    with engine.begin() as connection:
        for column_name, column_type in column_types.items():
            existing_columns = {column["name"] for column in inspect(connection).get_columns("alerts")}
            if column_name not in existing_columns:
                sql_type = column_type.compile(dialect=engine.dialect)
                constraints = " NOT NULL DEFAULT 0" if column_name == "peak_severity" else ""
                if engine.dialect.name == "postgresql":
                    connection.execute(text(f"ALTER TABLE alerts ADD COLUMN IF NOT EXISTS {column_name} {sql_type}{constraints}"))
                else:
                    connection.execute(text(f"ALTER TABLE alerts ADD COLUMN {column_name} {sql_type}{constraints}"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
