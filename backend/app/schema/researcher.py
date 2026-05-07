from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional, List, Dict
from datetime import datetime
from app.schema.publication import PublicationSchema

class ResearcherSchema(BaseModel):
    id: UUID
    orcid_id: str
    name: Optional[str]
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
    orcid_ids: List[str] = Field(min_length=1)


class ResearcherSearchErrorSchema(BaseModel):
    orcid_id: str
    detail: str


class ResearcherBatchSearchResponseSchema(BaseModel):
    results: List[ResearcherWithPublicationsSchema]
    errors: List[ResearcherSearchErrorSchema]
    total_requested: int
    total_processed: int
