import os
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from app.db.models import Researcher
from app.db.session import get_db

load_dotenv()


_bearer = HTTPBearer(auto_error=False)


def _settings() -> tuple[str, str, int]:
    # Fallback de desarrollo para evitar 500 por configuración ausente.
    secret = os.getenv("JWT_SECRET") or "change_me"
    algorithm = os.getenv("JWT_ALGORITHM") or "HS256"
    expires_minutes = int(os.getenv("JWT_EXPIRES_MINUTES") or "720")
    return secret, algorithm, expires_minutes


def create_access_token(*, subject: str, extra: dict[str, Any] | None = None) -> str:
    secret, algorithm, expires_minutes = _settings()
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expires_minutes)).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, secret, algorithm=algorithm)


def get_current_researcher(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Researcher:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    secret, algorithm, _ = _settings()
    try:
        payload = jwt.decode(creds.credentials, secret, algorithms=[algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    orcid_id = payload.get("sub")
    if not isinstance(orcid_id, str) or not orcid_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    researcher = db.query(Researcher).filter(Researcher.orcid_id == orcid_id).first()
    if not researcher or not researcher.authenticated:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Researcher not authenticated")
    return researcher


def get_optional_current_researcher(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Researcher | None:
    """
    Devuelve el investigador autenticado si hay Bearer token.
    Si no hay token, devuelve None.
    Si hay token inválido, lanza 401.
    """
    if not creds or not creds.credentials:
        return None
    return get_current_researcher(creds=creds, db=db)
