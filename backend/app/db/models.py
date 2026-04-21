from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .session import Base
import uuid


class Researcher(Base):
    __tablename__ = "researchers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    orcid_id = Column(String(19), unique=True, nullable=False)
    name = Column(Text)
    authenticated = Column(Boolean, default=False)
    access_token = Column(Text, nullable=True)
    last_sync_at = Column(DateTime(timezone=True), server_default=func.now())

    publications = relationship(
        "Publication",
        back_populates="researcher",
        cascade="all, delete-orphan"
    )

    sync_jobs = relationship(
        "SyncJob",
        back_populates="researcher",
        cascade="all, delete-orphan"
    )


class Publication(Base):
    __tablename__ = "publications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    researcher_id = Column(UUID(as_uuid=True), ForeignKey("researchers.id"))
    put_code = Column(Integer)
    title = Column(Text)
    journal = Column(Text)
    doi = Column(Text)
    pub_year = Column(Integer)
    type = Column(Text)
    hash_fingerprint = Column(Text)
    last_modified = Column(DateTime(timezone=True))

    researcher = relationship("Researcher", back_populates="publications")


class SyncJob(Base):
    __tablename__ = "sync_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    researcher_id = Column(UUID(as_uuid=True), ForeignKey("researchers.id"))
    status = Column(String(20))
    new_records = Column(Integer, default=0)
    updated_records = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True))

    researcher = relationship("Researcher", back_populates="sync_jobs")
