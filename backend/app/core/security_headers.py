from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import Settings


_DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")

_BASE_CSP = (
    "default-src 'none'; "
    "frame-ancestors 'none'; "
    "base-uri 'none'; "
    "form-action 'none'"
)

_SWAGGER_CSP = (
    "default-src 'self'; "
    "img-src 'self' data: https://fastapi.tiangolo.com; "
    "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    "style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    "font-src 'self' data: https://cdn.jsdelivr.net; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Inserta cabeceras de seguridad en cada respuesta.
    """

    def __init__(self, app, settings: Settings):
        super().__init__(app)
        self._settings = settings

    async def dispatch(self, request: Request, call_next) -> Response:
        response: Response = await call_next(request)

        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "geolocation=(), microphone=(), camera=(), payment=(), usb=(), "
            "accelerometer=(), gyroscope=(), magnetometer=(), interest-cohort=()",
        )
       
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
        response.headers.setdefault("X-Permitted-Cross-Domain-Policies", "none")

        if request.url.path in _DOCS_PATHS:
            response.headers.setdefault("Content-Security-Policy", _SWAGGER_CSP)
        else:
            response.headers.setdefault("Content-Security-Policy", _BASE_CSP)

        if request.url.scheme == "https" or self._settings.is_production:
            hsts = f"max-age={self._settings.SECURITY_HSTS_SECONDS}"
            if self._settings.SECURITY_HSTS_INCLUDE_SUBDOMAINS:
                hsts += "; includeSubDomains"
            if self._settings.SECURITY_HSTS_PRELOAD:
                hsts += "; preload"
            response.headers.setdefault("Strict-Transport-Security", hsts)

        if "server" in response.headers:
            del response.headers["server"]
        if "x-powered-by" in response.headers:
            del response.headers["x-powered-by"]

        return response
