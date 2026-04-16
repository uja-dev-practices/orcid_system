from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from .session import Base
import uuid

class Researcher(Base):
    __tablename__ = "researchers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    orcid_id = Column(String(19), unique=True, nullable=False)
    name = Column(Text)
    authenticated = Column(Boolean, default=False)
    access_token = Column(Text)
    last_sync_at = Column(DateTime)

class Publication(Base):
    __tablename__ = "publications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    researcher_id = Column(UUID(as_uuid=True))
    put_code = Column(Integer)
    title = Column(Text)
    doi = Column(Text)
    pub_year = Column(Integer)
    type = Column(Text)
    hash_fingerprint = Column(Text)
    last_modified = Column(DateTime)
