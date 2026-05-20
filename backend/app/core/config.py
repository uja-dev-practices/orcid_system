"""
Configuración tipada y validada del backend.

Centraliza la lectura de variables de entorno, valida secretos críticos al
arranque y evita fallbacks inseguros (p. ej. JWT_SECRET="change_me") en
entornos productivos.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import List, Literal
from urllib.parse import urlparse

from dotenv import load_dotenv
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_ENV_DIR = Path(__file__).resolve().parents[2]
_ENV_PATH = _ENV_DIR / ".env"
_ENV_LOCAL_PATH = _ENV_DIR / ".env.local"

# Carga en cascada: `.env` (versionado en GitLab con valores de prod) y
# opcionalmente `.env.local` (gitignored) para sandbox / ngrok en local.
load_dotenv(dotenv_path=_ENV_PATH, override=False)
if _ENV_LOCAL_PATH.is_file():
    load_dotenv(dotenv_path=_ENV_LOCAL_PATH, override=True)


def _split_csv(value: str | List[str] | None) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip().rstrip("/") for v in value if str(v).strip()]
    return [v.strip().rstrip("/") for v in value.split(",") if v.strip()]


class Settings(BaseSettings):
    """
    Settings inmutables para toda la aplicación.

    En `production` se aplican validaciones más estrictas:
    - JWT_SECRET no puede ser un valor débil ni por defecto.
    - CORS_ALLOWED_ORIGINS no puede contener "*".
    - Se exige ORCID_CLIENT_ID/SECRET y API_KEY_VALUE.
    """

    model_config = SettingsConfigDict(
        env_file=str(_ENV_PATH),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False

    DATABASE_URL: str = Field(...)
    REDIS_URL: str | None = None
    BASE_URL: str = "http://localhost:8000/api"

    JWT_SECRET: str = Field(...)
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_MINUTES: int = 720
    JWT_ISSUER: str = "orcid-sword-backend"
    JWT_AUDIENCE: str = "orcid-sword-frontend"

    API_KEY_NAME: str = "X-API-Key"
    API_KEY_VALUE: str = Field(...)

    ORCID_CLIENT_ID: str = Field(...)
    ORCID_CLIENT_SECRET: str = Field(...)
    ORCID_REDIRECT_URI: str = "http://localhost:8000/api/auth/orcid/callback"
    ORCID_ENVIRONMENT: Literal["sandbox", "production"] | None = None
    ORCID_OAUTH_STATE_ENABLED: bool = True
    ORCID_OAUTH_STATE_COOKIE: str = "orcid_oauth_state"
    ORCID_OAUTH_STATE_TTL_SECONDS: int = 600

    CORS_ALLOWED_ORIGINS: str = ""

    TRUSTED_HOSTS: str = "*"

    RATE_LIMIT_DEFAULT: str = "60/minute"
    RATE_LIMIT_AUTH: str = "10/minute"
    RATE_LIMIT_SEARCH_ANON: str = "5/minute"
    RATE_LIMIT_SEARCH_AUTH: str = "30/minute"
    RATE_LIMIT_EXPORT: str = "20/minute"
    RATE_LIMIT_SYNC: str = "5/minute"

    MAX_ORCID_BATCH: int = 25
    MAX_PUB_IDS_BATCH: int = 500
    MAX_REQUEST_BODY_BYTES: int = 1_048_576  # 1 MiB

    SYNC_SCHEDULER_ENABLED: bool = True
    SYNC_SCHEDULE_MODE: Literal["monthly_cron", "interval_minutes"] = "monthly_cron"
    SYNC_CRON_DAY: int = 1
    SYNC_CRON_HOUR: int = 3
    SYNC_INTERVAL_MINUTES: int = 60

    # Por publicación, GET /work/{put_code} es muy costoso (timeouts con cientos de works).
    # Por defecto solo se usa el resumen de GET /works. Si se pide enrich, como máximo
    # se harán tantas peticiones de detalle (el resto se normaliza solo con summary).
    ORCID_WORK_DETAIL_ENRICH_MAX: int = 50

    DOCS_ENABLED: bool = True

    SECURITY_HSTS_SECONDS: int = 31_536_000
    SECURITY_HSTS_INCLUDE_SUBDOMAINS: bool = True
    SECURITY_HSTS_PRELOAD: bool = False

    @model_validator(mode="after")
    def _validate_security(self) -> "Settings":
        cors_origins = self.cors_allowed_origins
        trusted_hosts = self.trusted_hosts

        if self.ENVIRONMENT == "production":
            weak = {"change_me", "changeme", "secret", "password", ""}
            if self.JWT_SECRET.strip().lower() in weak:
                raise ValueError(
                    "JWT_SECRET es débil o está sin configurar. "
                    "Define un secreto aleatorio fuerte (>= 32 bytes)."
                )
            if len(self.JWT_SECRET) < 32:
                raise ValueError(
                    "JWT_SECRET debe tener al menos 32 caracteres en producción."
                )
            if "*" in cors_origins:
                raise ValueError(
                    "CORS_ALLOWED_ORIGINS no puede contener '*' en producción."
                )
            if not cors_origins:
                raise ValueError(
                    "CORS_ALLOWED_ORIGINS debe definirse explícitamente en producción."
                )
            if not self.API_KEY_VALUE or len(self.API_KEY_VALUE) < 24:
                raise ValueError(
                    "API_KEY_VALUE debe tener al menos 24 caracteres en producción."
                )
            if trusted_hosts == ["*"]:
                raise ValueError(
                    "TRUSTED_HOSTS debe definirse explícitamente en producción."
                )

        for origin in cors_origins:
            parsed = urlparse(origin)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                raise ValueError(f"Origen CORS inválido: {origin!r}")

        return self

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def orcid_environment(self) -> str:
        """Which ORCID API tier to use (sandbox | production).

        Defaults to 'production' when ENVIRONMENT=production, 'sandbox'
        otherwise. Can be overridden explicitly with ORCID_ENVIRONMENT
        in the .env to e.g. run production security + sandbox ORCID."""
        if self.ORCID_ENVIRONMENT is not None:
            return self.ORCID_ENVIRONMENT
        return "production" if self.is_production else "sandbox"

    @property
    def cors_allowed_origins(self) -> List[str]:
        return _split_csv(self.CORS_ALLOWED_ORIGINS)

    @property
    def trusted_hosts(self) -> List[str]:
        parsed = _split_csv(self.TRUSTED_HOSTS)
        return parsed or ["*"]

    @property
    def docs_url(self) -> str | None:
        return "/docs" if self.DOCS_ENABLED else None

    @property
    def redoc_url(self) -> str | None:
        return "/redoc" if self.DOCS_ENABLED else None

    @property
    def openapi_url(self) -> str | None:
        return "/openapi.json" if self.DOCS_ENABLED else None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Devuelve la instancia única de configuración.

    Se cachea para no releer entorno/archivos en cada request.
    """
    return Settings()  # type: ignore[call-arg]


settings = get_settings()


def reload_settings_for_tests() -> Settings:
    """
    Helper para tests: invalida la caché y recarga settings.
    """
    get_settings.cache_clear()
    globals()["settings"] = get_settings()
    return globals()["settings"]


__all__ = ["Settings", "get_settings", "reload_settings_for_tests", "settings"]
