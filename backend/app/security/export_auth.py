"""
Autorización para exportaciones.

Permite descargas desde la web (proxy inyecta X-API-Key) o con JWT de usuario,
pero bloquea llamadas directas anónimas sin credenciales.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status

from app.db.models import Researcher
from app.security.api_key import api_key_header, is_valid_api_key
from app.security.jwt import get_optional_current_researcher


def require_export_access(
    api_key: str | None = Depends(api_key_header),
    current: Researcher | None = Depends(get_optional_current_researcher),
) -> Researcher | None:
    """
  Allow export when the proxy supplies a valid API key and/or the user
  sends a valid Bearer token. Prefer returning `current` when both are
  present so per-user download tracking is recorded on export.
    """
    if api_key is not None and not is_valid_api_key(api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )

    if current is not None:
        return current

    if api_key is not None:
        return None

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing API key",
    )
