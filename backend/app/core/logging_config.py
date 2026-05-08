"""
Configuración de logging estructurada y minimalista.

- Formatea con timestamp, nivel y logger.
- En producción usa nivel INFO; en desarrollo DEBUG.
- Silencia logs ruidosos de librerías externas para no filtrar headers.
"""

from __future__ import annotations

import logging

from app.core.config import settings


_LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s :: %(message)s"


def configure_logging() -> None:
    level = logging.DEBUG if settings.DEBUG else logging.INFO

    logging.basicConfig(level=level, format=_LOG_FORMAT)

    for noisy in ("httpx", "httpcore", "sqlalchemy.engine.Engine"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logging.getLogger("uvicorn.error").setLevel(level)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
