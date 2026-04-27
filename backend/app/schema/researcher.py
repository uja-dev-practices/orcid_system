from pydantic import BaseModel
from uuid import UUID
from typing import Optional, List
from datetime import datetime
from app.schema.publication import PublicationSchema

class ResearcherSchema(BaseModel):
    id: UUID
    orcid_id: str
    name: Optional[str]
    authenticated: bool
    last_sync_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ResearcherWithPublicationsSchema(BaseModel):
    researcher: ResearcherSchema
    publications: List[PublicationSchema]

    # NUEVOS CAMPOS
    new_records: int
    updated_records: int
    unchanged_records: int
    total_records: int

    model_config = {"from_attributes": True}
