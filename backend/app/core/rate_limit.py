"""
Rate limiting basado en SlowAPI.

- Usa Redis como backend si `REDIS_URL` está definido (compartido entre workers).
- Cae a memoria local en desarrollo si Redis no está disponible.
- Identifica al cliente por IP y, cuando hay JWT, también por `sub` (orcid_id),
  para que un atacante autenticado no comparta cupo con su IP.
"""

from __future__ import annotations

from typing import Optional

from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings


def _key_func(request: Request) -> str:
    """
    Devuelve la clave de rate limit para el request.

    - Si hay un investigador autenticado en el state, usa su orcid_id.
    - En caso contrario, usa la IP remota.
    """
    researcher = getattr(request.state, "researcher", None)
    if researcher is not None:
        return f"user:{getattr(researcher, 'orcid_id', None) or researcher.id}"
    return f"ip:{get_remote_address(request)}"


def _build_limiter() -> Limiter:
    storage_uri: Optional[str] = settings.REDIS_URL
    return Limiter(
        key_func=_key_func,
        default_limits=[settings.RATE_LIMIT_DEFAULT],
        storage_uri=storage_uri,
        headers_enabled=False,
        strategy="fixed-window",
    )


limiter = _build_limiter()


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Respuesta uniforme cuando se supera el límite.

    No revela límites internos exactos para reducir oráculo a atacantes.
    """
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests, slow down."},
        headers={"Retry-After": "60"},
    )
