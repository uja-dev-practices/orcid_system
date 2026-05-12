from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.db.session import Base

# ---------------------------------------------------------
# Modelo de investigador
# ---------------------------------------------------------

class Researcher(Base):
    __tablename__ = "researchers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    orcid_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    authenticated = Column(Boolean, default=False)
    last_sync_at = Column(DateTime, nullable=True)

    publications = relationship("Publication", back_populates="researcher", cascade="all, delete-orphan")

# ---------------------------------------------------------
# Modelo de publicación
# ---------------------------------------------------------

class Publication(Base):
    __tablename__ = "publications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    researcher_id = Column(UUID(as_uuid=True), ForeignKey("researchers.id"), nullable=False)
    researcher = relationship("Researcher", back_populates="publications")

    # ORCID core
    put_code = Column(Integer, index=True, nullable=False)
    title = Column(String, nullable=True)
    subtitle = Column(String, nullable=True)
    type = Column(String, nullable=True)

    # Journal / container
    journal = Column(String, nullable=True)

    # Dates
    pub_year = Column(Integer, nullable=True)
    pub_month = Column(Integer, nullable=True)
    pub_day = Column(Integer, nullable=True)

    # Identifiers / links
    doi = Column(String, nullable=True)
    url = Column(String, nullable=True)

    # Description / citation
    short_description = Column(String, nullable=True)
    citation_type = Column(String, nullable=True)
    citation_value = Column(String, nullable=True)

    # Language / country
    language_code = Column(String, nullable=True)
    country = Column(String, nullable=True)

    # Extra structured data
    external_ids = Column(JSONB, nullable=True)   # lista de external-id normalizados
    contributors = Column(JSONB, nullable=True)   # lista de autores/roles

    # Tu campo existente
    hash_fingerprint = Column(String, nullable=True)
    last_modified = Column(DateTime, nullable=True, default=None)

    # Legacy: descargado global (deprecado). Mantener por compatibilidad de DB.
    downloaded = Column(Boolean, nullable=False, default=False)

# ---------------------------------------------------------
# Modelo de descarga de publicación
# ---------------------------------------------------------

class PublicationDownload(Base):
    """
    Marca de descarga por usuario (researcher) sobre cualquier publicación.
    Una fila por (researcher_id, publication_id).
    """

    __tablename__ = "publication_downloads"
    __table_args__ = (
        UniqueConstraint("researcher_id", "publication_id", name="uq_publication_download"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    researcher_id = Column(UUID(as_uuid=True), ForeignKey("researchers.id"), nullable=False, index=True)
    publication_id = Column(UUID(as_uuid=True), ForeignKey("publications.id"), nullable=False, index=True)
    downloaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)
