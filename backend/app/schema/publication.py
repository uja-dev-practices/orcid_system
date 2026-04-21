from pydantic import BaseModel
from uuid import UUID

class PublicationSchema(BaseModel):
    id: UUID
    put_code: int | None = None
    title: str
    journal: str | None = None
    doi: str | None = None
    pub_year: int | None = None
    type: str | None = None
    hash_fingerprint: str | None = None
    last_modified: str | None = None

    class Config:
        from_attributes = True
