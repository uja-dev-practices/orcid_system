"""
Manejadores de errores que NO filtran información sensible.

- En producción, las excepciones no controladas devuelven un mensaje genérico.
- En desarrollo, se incluye `type` para depurar (sin trazas).
- Errores de validación se devuelven con 422 estándar de FastAPI.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings


logger = logging.getLogger("app.error")


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=getattr(exc, "headers", None),
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    safe_errors = []
    for err in exc.errors():
        safe_errors.append(
            {
                "loc": err.get("loc"),
                "msg": err.get("msg"),
                "type": err.get("type"),
            }
        )
    return JSONResponse(status_code=422, content={"detail": safe_errors})


async def sqlalchemy_exception_handler(
    request: Request, exc: SQLAlchemyError
) -> JSONResponse:
    error_id = str(uuid.uuid4())
    logger.exception("DB error [%s] on %s %s", error_id, request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Database error", "error_id": error_id},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    error_id = str(uuid.uuid4())
    logger.exception(
        "Unhandled error [%s] on %s %s", error_id, request.method, request.url.path
    )
    payload: dict = {"detail": "Internal server error", "error_id": error_id}
    if not settings.is_production and settings.DEBUG:
        payload["type"] = exc.__class__.__name__
    return JSONResponse(status_code=500, content=payload)
