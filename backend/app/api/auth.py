import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.models import Researcher
from app.db.session import get_db
from app.schema.auth import OrcidLoginResponseSchema
from app.security.jwt import create_access_token
from app.security.oauth_state import (
    attach_state_cookie,
    clear_state_cookie,
    generate_state,
    validate_state,
)
from app.services.orcid_client import ORCIDClient
from app.utils.orcid_validator import is_valid_orcid


router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger("app.auth")


def _extract_display_name(record: dict) -> str | None:
    person = (record or {}).get("person") or {}
    name = person.get("name") or {}
    given_obj = name.get("given-names")
    family_obj = name.get("family-name")
    given = given_obj.get("value") if isinstance(given_obj, dict) else None
    family = family_obj.get("value") if isinstance(family_obj, dict) else None
    full = " ".join(p for p in [given, family] if p)
    return full or None


def _orcid_redirect_uri() -> str:
    return settings.ORCID_REDIRECT_URI


def _complete_oauth_login(*, code: str, db: Session) -> OrcidLoginResponseSchema:
    """
    1) Intercambia el `code` con ORCID (server-side).
    2) Crea/actualiza el investigador.
    3) Emite el JWT propio.
    """
    if not code or len(code) > 256:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ORCID authorization code")

    client = ORCIDClient()
    try:
        token_data = client.exchange_authorization_code(code=code, redirect_uri=_orcid_redirect_uri())
    except httpx.HTTPStatusError as exc:
        logger.warning("ORCID token exchange failed: %s", exc.response.status_code)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="ORCID token exchange failed",
        ) from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="ORCID timeout") from exc
    except Exception as exc:
        logger.exception("Unexpected error during ORCID token exchange")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="ORCID unavailable") from exc

    orcid_id = (token_data.get("orcid") or "").strip()
    if not is_valid_orcid(orcid_id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ORCID returned by OAuth")

    display_name = token_data.get("name")
    if not display_name:
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


def complete_oauth_login_response(
    *, request: Request, code: str, state: str | None, db: Session
) -> JSONResponse:
    """
    Valida `state`, completa el login y limpia la cookie del state.
    Devuelve directamente la JSONResponse (para poder borrar cookie).
    """
    validate_state(request, state)
    payload = _complete_oauth_login(code=code, db=db)
    json_resp = JSONResponse(content=payload.model_dump())
    clear_state_cookie(json_resp)
    return json_resp


# ---------------------------------------------------------
# ENDPOINT 1: Iniciar flujo OAuth 3-legged hacia ORCID
# ---------------------------------------------------------

@router.get("/orcid/authorize")
@limiter.limit(settings.RATE_LIMIT_AUTH)
def authorize_orcid(request: Request):
    """
    Genera la URL de autorización ORCID y persiste el `state` en cookie
    HttpOnly para validarlo en el callback (anti-CSRF).
    """
    client = ORCIDClient()
    state = generate_state() if settings.ORCID_OAUTH_STATE_ENABLED else None
    authorize_url = client.build_authorize_url(
        redirect_uri=_orcid_redirect_uri(),
        scope="/authenticate",
        state=state,
    )
    response = RedirectResponse(authorize_url)
    if state:
        attach_state_cookie(response, state)
    return response


# ---------------------------------------------------------
# ENDPOINT 2: Callback OAuth 3-legged desde ORCID
# ---------------------------------------------------------

@router.get("/orcid/callback", response_model=OrcidLoginResponseSchema)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def orcid_callback(
    request: Request,
    code: str,
    state: str | None = None,
    db: Session = Depends(get_db),
):
    return complete_oauth_login_response(request=request, code=code, state=state, db=db)
