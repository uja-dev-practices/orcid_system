"""
Entry point del backend FastAPI.

Aplica un perfil de seguridad por defecto:
- Configuración tipada (Pydantic Settings) que falla rápido en producción.
- TrustedHostMiddleware (anti Host-header injection).
- CORS con lista blanca estricta (sin `*`).
- Body size limit (anti DoS por payload).
- Cabeceras de seguridad HTTP.
- Rate limiting (slowapi) con backend Redis si está configurado.
- Error handlers que NO filtran trazas ni internals.
"""

from __future__ import annotations

import logging

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.auth import complete_oauth_login_response, router as auth_router
from app.api.export import router as export_router
from app.api.researchers import router as researchers_router
from app.core.body_size import BodySizeLimitMiddleware
from app.core.config import settings
from app.core.error_handlers import (
    http_exception_handler,
    sqlalchemy_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.core.logging_config import configure_logging
from app.core.rate_limit import limiter, rate_limit_exceeded_handler
from app.core.security_headers import SecurityHeadersMiddleware
from app.db.session import get_db, init_db
from app.scheduler.sync_scheduler import start_scheduler
from app.schema.auth import OrcidLoginResponseSchema


configure_logging()
logger = logging.getLogger("app.main")


app = FastAPI(
    title="ORCID SWORD Backend",
    description="Backend para sincronización ORCID y exportación SWORD",
    version="1.0.0",
    docs_url=settings.docs_url,
    redoc_url=settings.redoc_url,
    openapi_url=settings.openapi_url,
)


# ---------------------------------------------------------
# Middlewares (orden importa: el último añadido es el más externo)
# ---------------------------------------------------------

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

app.add_middleware(SecurityHeadersMiddleware, settings=settings)

app.add_middleware(
    BodySizeLimitMiddleware,
    max_bytes=settings.MAX_REQUEST_BODY_BYTES,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        settings.API_KEY_NAME,
    ],
    expose_headers=["Content-Disposition", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    max_age=600,
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.trusted_hosts,
)


# ---------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------

app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)


# ---------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------

@app.on_event("startup")
def on_startup() -> None:
    init_db()
    start_scheduler()
    logger.info(
        "Backend ready (env=%s, docs=%s)",
        settings.ENVIRONMENT,
        bool(settings.DOCS_ENABLED),
    )


# ---------------------------------------------------------
# Healthcheck
# ---------------------------------------------------------

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ---------------------------------------------------------
# Alias del callback OAuth (mismo flujo, mismo endurecimiento)
# ---------------------------------------------------------

@app.get("/callback", response_model=OrcidLoginResponseSchema)
def oauth_callback_root(
    request: Request,
    code: str,
    state: str | None = None,
    db: Session = Depends(get_db),
):
    """
    Alias para integraciones que registran un redirect_uri tipo
    `https://<host>/callback` en ORCID.
    """
    return complete_oauth_login_response(request=request, code=code, state=state, db=db)


# ---------------------------------------------------------
# Routers
# ---------------------------------------------------------

app.include_router(researchers_router, prefix="/api")
app.include_router(export_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
