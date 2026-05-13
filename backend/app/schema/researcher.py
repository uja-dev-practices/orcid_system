from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.schema.publication import PublicationSchema
from app.utils.orcid_validator import ORCID_PATTERN, is_valid_orcid


class ResearcherSchema(BaseModel):
    id: UUID
    orcid_id: str = Field(min_length=19, max_length=19, pattern=ORCID_PATTERN)
    name: Optional[str] = Field(default=None, max_length=255)
    authenticated: bool
    last_sync_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ResearcherStatsSchema(BaseModel):
    total_publications: int
    publication_types: Dict[str, int]


class ResearcherWithPublicationsSchema(BaseModel):
    researcher: ResearcherSchema
    publications: List[PublicationSchema]
    stats: ResearcherStatsSchema

    new_records: int
    updated_records: int
    unchanged_records: int
    total_records: int

    model_config = {"from_attributes": True}


class ResearcherBatchSearchRequestSchema(BaseModel):
    orcid_ids: List[str] = Field(
        min_length=1,
        max_length=settings.MAX_ORCID_BATCH,
    )

    @field_validator("orcid_ids")
    @classmethod
    def _validate_each(cls, value: List[str]) -> List[str]:
        deduped: List[str] = []
        seen = set()
        for v in value:
            if not isinstance(v, str):
                raise ValueError("ORCID iD debe ser string")
            if not is_valid_orcid(v):
                raise ValueError(f"ORCID iD inválido: {v}")
            if v not in seen:
                seen.add(v)
                deduped.append(v)
        return deduped


class ResearcherSearchErrorSchema(BaseModel):
    orcid_id: str
    detail: str


class ResearcherBatchSearchResponseSchema(BaseModel):
    results: List[ResearcherWithPublicationsSchema]
    errors: List[ResearcherSearchErrorSchema]
    total_requested: int
    total_processed: int
