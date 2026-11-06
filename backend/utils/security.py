import os


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
    raise RuntimeError(f"{name} must be set to true or false")


def get_allowed_origins() -> tuple[str, ...]:
    configured = os.getenv("FRONTEND_ORIGINS", os.getenv("FRONTEND_URL", "https://driversafe.vercel.app"))
    return tuple(origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip())


IS_PRODUCTION = _is_production()
AUTH_COOKIE_SECURE = _env_bool("AUTH_COOKIE_SECURE", IS_PRODUCTION)
AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "none" if IS_PRODUCTION else "lax").strip().lower()
AUTH_COOKIE_DOMAIN = os.getenv("AUTH_COOKIE_DOMAIN", "").strip() or None

if AUTH_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    raise RuntimeError("AUTH_COOKIE_SAMESITE must be lax, strict, or none")
if IS_PRODUCTION and not AUTH_COOKIE_SECURE:
    raise RuntimeError("AUTH_COOKIE_SECURE must be true in production")
if AUTH_COOKIE_SAMESITE == "none" and not AUTH_COOKIE_SECURE:
    raise RuntimeError("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAMESITE is none")

