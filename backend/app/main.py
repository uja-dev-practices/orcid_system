from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.db.session import init_db
from app.db.session import get_db
from app.api.researchers import router as researchers_router
from app.api.export import router as export_router
from app.api.auth import router as auth_router
from app.api.auth import _complete_oauth_login
from app.schema.auth import OrcidLoginResponseSchema
from app.scheduler.sync_scheduler import start_scheduler


# ---------------------------------------------------------
# Crear instancia principal de FastAPI
# ---------------------------------------------------------
app = FastAPI(
    title="ORCID SWORD Backend",
    description="Backend para sincronización ORCID y exportación SWORD",
    version="1.0.0"
)


# ---------------------------------------------------------
# Crear tablas al iniciar la aplicación
# ---------------------------------------------------------
@app.on_event("startup")
def startup_event():
    init_db()          # 🔥 CREA TABLAS
    start_scheduler()  # 🔥 INICIA SCHEDULER


# ---------------------------------------------------------
# Healthcheck
# ---------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/callback", response_model=OrcidLoginResponseSchema)
def oauth_callback_root(code: str, db: Session = Depends(get_db)):
    """
    Alias para probar redirect URIs como `https://127.0.0.1/callback` en local.
    Intercambia el code con ORCID y emite el JWT.
    """
    return _complete_oauth_login(code=code, db=db)


# ---------------------------------------------------------
# Registrar routers
# ---------------------------------------------------------
app.include_router(researchers_router, prefix="/api")
app.include_router(export_router, prefix="/api")
app.include_router(auth_router, prefix="/api")


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # en producción limitar
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
