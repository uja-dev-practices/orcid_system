from fastapi import FastAPI
from app.api.researchers import router as researchers_router
from app.db.session import Base, engine


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
    Base.metadata.create_all(bind=engine)


# ---------------------------------------------------------
# Healthcheck
# ---------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------
# Registrar routers
# ---------------------------------------------------------
app.include_router(researchers_router)
