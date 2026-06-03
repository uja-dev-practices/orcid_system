from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

# Cargar variables del .env para ejecuciones locales (en Docker ya vendrán por entorno).
load_dotenv()

# -----------------------------
# DATABASE URL
# -----------------------------

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(
    DATABASE_URL,
    future=True,
    echo=False
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


# -----------------------------
# DB SESSION DEPENDENCY
# -----------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------------
# INIT DB (CREA TABLAS)
# -----------------------------

def init_db():

    # Importa modelos para que SQLAlchemy los registre

    import app.db.models  # noqa

    # Crea todas las tablas si no existen

    Base.metadata.create_all(bind=engine)

    # Pequeñas migraciones "best-effort" para entornos sin Alembic.
    # (create_all no altera tablas existentes)

    _ensure_columns()

# ---------------------------------------------------------
# Función auxiliar: asegurar columnas existentes
# ---------------------------------------------------------

def _ensure_columns():
    insp = inspect(engine)
    table_names = set(insp.get_table_names())

    if "publications" in table_names:
        cols = {c["name"] for c in insp.get_columns("publications")}
        if "downloaded" not in cols:
            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE publications ADD COLUMN downloaded BOOLEAN NOT NULL DEFAULT FALSE")
                )

    # Per-user download tracking (PublicationDownload model).
    if "publication_downloads" not in table_names:
        from app.db.models import PublicationDownload  # noqa: F401

        PublicationDownload.__table__.create(bind=engine, checkfirst=True)
