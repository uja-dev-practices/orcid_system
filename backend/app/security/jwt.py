"""
Emisión y verificación de JWT.

Endurecimiento aplicado:
- Sin fallback de secreto débil: si la configuración no es válida, falla al arranque.
- `iss` y `aud` obligatorios.
- `nbf` (not-before) y `iat` validados.
- `typ=access` para evitar mezclar tipos de token.
- Algoritmo fijo (no se acepta "none" ni cambios por payload).
- Errores opacos: nunca se expone el motivo del fallo de verificación al cliente.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Researcher
from app.db.session import get_db
from app.utils.orcid_validator import is_valid_orcid


_bearer = HTTPBearer(auto_error=False)


def create_access_token(*, subject: str, extra: dict[str, Any] | None = None) -> str:
    """
    Emite un access token firmado con HS256 (configurable).

    `subject` debe ser el ORCID iD verificado del investigador.
    """
    if not is_valid_orcid(subject):
        raise ValueError("subject must be a valid ORCID iD")

    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "sub": subject,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.JWT_EXPIRES_MINUTES)).timestamp()),
        "jti": uuid4().hex,
        "typ": "access",
    }
    if extra:
        for reserved in ("iss", "aud", "sub", "iat", "nbf", "exp", "jti", "typ"):
            extra.pop(reserved, None)
        payload.update(extra)

    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def _decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
            options={
                "require_iat": True,
                "require_nbf": True,
                "require_exp": True,
                "require_aud": True,
                "require_iss": True,
            },
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_researcher(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Researcher:
    if not creds or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = _decode_token(creds.credentials)

    if payload.get("typ") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )

    orcid_id = payload.get("sub")
    if not isinstance(orcid_id, str) or not is_valid_orcid(orcid_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    researcher = db.query(Researcher).filter(Researcher.orcid_id == orcid_id).first()
    if not researcher or not researcher.authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Researcher not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    request.state.researcher = researcher
    return researcher


def get_optional_current_researcher(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Researcher | None:
    """
    Devuelve el investigador autenticado si hay Bearer válido y la sesión sigue activa.

    Sin Bearer, token inválido/expirado o investigador no autenticado → None.
    Las rutas públicas (p. ej. búsqueda) deben seguir funcionando aunque el navegador
    conserve un JWT caducado en localStorage.
    """
    if not creds or not creds.credentials:
        return None

    try:
        payload = _decode_token(creds.credentials)
    except HTTPException:
        return None

    if payload.get("typ") != "access":
        return None

    orcid_id = payload.get("sub")
    if not isinstance(orcid_id, str) or not is_valid_orcid(orcid_id):
        return None

    researcher = db.query(Researcher).filter(Researcher.orcid_id == orcid_id).first()
    if not researcher or not researcher.authenticated:
        return None

    request.state.researcher = researcher
    return researcher
