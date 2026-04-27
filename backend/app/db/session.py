from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

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
