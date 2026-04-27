from pydantic import BaseModel
from uuid import UUID
from typing import Optional, List, Any
from datetime import datetime

class PublicationSchema(BaseModel):
    id: UUID
    put_code: int | None = None
    title: str | None = None
    subtitle: str | None = None
    journal: str | None = None
    doi: str | None = None
    pub_year: int | None = None
    pub_month: int | None = None
    pub_day: int | None = None
    type: str | None = None
    url: str | None = None
    short_description: str | None = None
    citation_type: str | None = None
    citation_value: str | None = None
    language_code: str | None = None
    country: str | None = None
    external_ids: List[Any] | None = None
    contributors: List[Any] | None = None
    hash_fingerprint: str | None = None
    last_modified: datetime | None = None
    status: str | None = None

    class Config:
        from_attributes = True
