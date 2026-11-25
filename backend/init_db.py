"""Initialize the configured database before deploying the serverless app."""

try:
    from .database import ensure_tables
except ImportError:  # `python init_db.py` from the backend directory
    from database import ensure_tables


if __name__ == "__main__":
    ensure_tables()
    print("Database tables are ready.")
