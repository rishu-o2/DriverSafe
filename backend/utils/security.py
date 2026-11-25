import os
import logging
from urllib.parse import urlsplit


def _is_production() -> bool:
    return bool(os.getenv("VERCEL") or os.getenv("VERCEL_ENV") or os.getenv("ENVIRONMENT", "").lower() == "production")


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    logging.getLogger("driversafe.config").error("Invalid boolean configuration variable %s", name)
    raise RuntimeError(f"{name} must be set to true or false")


def get_allowed_origins() -> tuple[str, ...]:
    configured = os.getenv("FRONTEND_ORIGINS", os.getenv("FRONTEND_URL", "https://driversafe.vercel.app"))
    origins = {origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()}
    for variable in ("VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL"):
        host = os.getenv(variable, "").strip().strip("/")
        if host and "://" not in host and "/" not in host:
            origins.add(f"https://{host}")
    return tuple(sorted(origins))


def is_allowed_origin(origin: str, host: str, forwarded_proto: str | None = None) -> bool:
    normalized = origin.rstrip("/")
    if normalized in get_allowed_origins():
        return True
    parsed = urlsplit(normalized)
    expected_scheme = (forwarded_proto or "").split(",", 1)[0].strip().lower()
    if not expected_scheme:
        expected_scheme = "https" if _is_production() else "http"
    return (
        parsed.scheme.lower() == expected_scheme
        and parsed.netloc.lower() == host.lower()
        and parsed.path in {"", "/"}
        and not parsed.query
        and not parsed.fragment
    )


IS_PRODUCTION = _is_production()
AUTH_COOKIE_SECURE = _env_bool("AUTH_COOKIE_SECURE", IS_PRODUCTION)
AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "lax").strip().lower()
AUTH_COOKIE_DOMAIN = os.getenv("AUTH_COOKIE_DOMAIN", "").strip() or None

if AUTH_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    logging.getLogger("driversafe.config").error("Invalid configuration variable AUTH_COOKIE_SAMESITE")
    raise RuntimeError("AUTH_COOKIE_SAMESITE must be lax, strict, or none")
if IS_PRODUCTION and not AUTH_COOKIE_SECURE:
    logging.getLogger("driversafe.config").error("Invalid production cookie configuration: AUTH_COOKIE_SECURE")
    raise RuntimeError("AUTH_COOKIE_SECURE must be true in production")
if IS_PRODUCTION and AUTH_COOKIE_SAMESITE != "lax":
    logging.getLogger("driversafe.config").error("Invalid production cookie configuration: AUTH_COOKIE_SAMESITE")
    raise RuntimeError("AUTH_COOKIE_SAMESITE must be lax for same-origin production routing")
if IS_PRODUCTION and AUTH_COOKIE_DOMAIN:
    logging.getLogger("driversafe.config").error("Invalid production cookie configuration: AUTH_COOKIE_DOMAIN")
    raise RuntimeError("AUTH_COOKIE_DOMAIN must be empty for same-origin production routing")
if AUTH_COOKIE_SAMESITE == "none" and not AUTH_COOKIE_SECURE:
    logging.getLogger("driversafe.config").error("Invalid cookie configuration: AUTH_COOKIE_SECURE is required for SameSite=None")
    raise RuntimeError("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAMESITE is none")

