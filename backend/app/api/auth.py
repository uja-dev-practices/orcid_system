import httpx
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.db.models import Researcher
from app.db.session import get_db
from app.schema.auth import OrcidLoginResponseSchema
from app.security.jwt import create_access_token
from app.services.orcid_client import ORCIDClient
from app.utils.orcid_validator import is_valid_orcid

# Asegura que al ejecutar `uvicorn` local también se carga `backend/.env`.
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=False)


router = APIRouter(prefix="/auth", tags=["auth"])


def _extract_display_name(record: dict) -> str | None:
    person = (record or {}).get("person") or {}
    name = person.get("name") or {}
    given = ((name.get("given-names") or {}).get("value")) if isinstance(name.get("given-names"), dict) else None
    family = ((name.get("family-name") or {}).get("value")) if isinstance(name.get("family-name"), dict) else None
    full = " ".join([p for p in [given, family] if p])
    return full or None


def _orcid_redirect_uri() -> str:
    # Debe coincidir con el `redirect_uri` registrado en tu integración ORCID.
    return os.getenv("ORCID_REDIRECT_URI") or "http://localhost:8000/api/auth/orcid/callback"


def _complete_oauth_login(*, code: str, db: Session) -> OrcidLoginResponseSchema:
    """
    Completa el login OAuth:
    1) intercambio del `code` en ORCID (server-side)
    2) crea/actualiza el investigador
    3) emite nuestro JWT
    """
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing ORCID authorization code")

    client = ORCIDClient()
    redirect_uri = _orcid_redirect_uri()

    try:
        token_data = client.exchange_authorization_code(code=code, redirect_uri=redirect_uri)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"ORCID token error ({exc.response.status_code})",
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="ORCID timeout")
    except Exception:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="ORCID unavailable")

    orcid_id = (token_data.get("orcid") or "").strip()
    if not is_valid_orcid(orcid_id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ORCID returned by OAuth")

    display_name = token_data.get("name")
    if not display_name:
        # Fallback si ORCID no devuelve `name` en el token response.
        try:
            record = client.fetch_record(orcid_id)
            display_name = _extract_display_name(record)
        except Exception:
            display_name = None

    researcher = db.query(Researcher).filter(Researcher.orcid_id == orcid_id).first()
    if not researcher:
        researcher = Researcher(orcid_id=orcid_id, name=display_name, authenticated=True)
        db.add(researcher)
    else:
        researcher.authenticated = True
        if display_name and not researcher.name:
            researcher.name = display_name

    db.commit()
    db.refresh(researcher)

    token = create_access_token(subject=orcid_id, extra={"rid": str(researcher.id)})
    return OrcidLoginResponseSchema(access_token=token)


@router.get("/orcid/authorize")
def authorize_orcid():
    """
    Inicia el flujo OAuth 3-legged (authorization code) hacia ORCID.
    """
    client = ORCIDClient()
    authorize_url = client.build_authorize_url(
        redirect_uri=_orcid_redirect_uri(),
        # Solo necesitamos el Authenticated iD del usuario.
        scope="/authenticate",
    )
    return RedirectResponse(authorize_url)


@router.get("/orcid/callback", response_model=OrcidLoginResponseSchema)
def orcid_callback(code: str, db: Session = Depends(get_db)):
    return _complete_oauth_login(code=code, db=db)

