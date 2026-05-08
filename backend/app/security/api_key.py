"""
Autenticación por API key (uso máquina-a-máquina, p. ej. el scheduler interno).

Endurecimiento:
- Comparación constante en tiempo (`hmac.compare_digest`) para evitar timing attacks.
- No se loggea el valor de la cabecera bajo ninguna circunstancia.
- Se separa este mecanismo del JWT de usuario; la API key NO debe usarse como
  prueba de identidad de un investigador.
"""

from __future__ import annotations

import hmac

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader

from app.core.config import settings


api_key_header = APIKeyHeader(name=settings.API_KEY_NAME, auto_error=False)


def _is_valid_key(provided: str | None) -> bool:
    if not provided or not settings.API_KEY_VALUE:
        return False
    return hmac.compare_digest(provided.encode("utf-8"), settings.API_KEY_VALUE.encode("utf-8"))


def get_api_key(api_key: str | None = Depends(api_key_header)) -> str:
    if not _is_valid_key(api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )
    return api_key  # type: ignore[return-value]


def get_api_key_optional(api_key: str | None = Depends(api_key_header)) -> str | None:
    """
    - Si no llega cabecera: None.
    - Si llega y es válida: la devuelve.
    - Si llega pero es inválida: 401.
    """
    if api_key is None:
        return None
    if not _is_valid_key(api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    return api_key
