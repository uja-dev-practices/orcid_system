"""
OAuth state anti-CSRF para el flujo de login con ORCID.

El parámetro `state` se genera en `/auth/orcid/authorize`, se guarda en una
cookie HttpOnly + SameSite=Lax con TTL corto, y se valida en el callback.

Si el `state` falta, no coincide o ha expirado, el login se rechaza.
"""

from __future__ import annotations

import hmac
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException, status
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings


_STATE_BYTES = 32


def generate_state() -> str:
    return secrets.token_urlsafe(_STATE_BYTES)


def attach_state_cookie(response: Response, state: str) -> None:
    """
    Persiste el `state` en una cookie segura y devuelve el valor crudo.
    """
    response.set_cookie(
        key=settings.ORCID_OAUTH_STATE_COOKIE,
        value=state,
        max_age=settings.ORCID_OAUTH_STATE_TTL_SECONDS,
        secure=settings.is_production,
        httponly=True,
        samesite="lax",
        path="/",
    )


def clear_state_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.ORCID_OAUTH_STATE_COOKIE,
        path="/",
    )


def validate_state(request: Request, received_state: str | None) -> None:
    """
    Compara el state recibido en el callback con el almacenado en cookie.

    Lanza 400 si no coincide o falta. Comparación en tiempo constante.
    """
    if not settings.ORCID_OAUTH_STATE_ENABLED:
        return

    cookie_value = request.cookies.get(settings.ORCID_OAUTH_STATE_COOKIE)
    if not cookie_value or not received_state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth state missing",
        )

    if not hmac.compare_digest(cookie_value.encode("utf-8"), received_state.encode("utf-8")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth state mismatch",
        )


def now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())
