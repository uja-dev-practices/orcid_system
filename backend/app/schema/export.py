"""
Schemas de los endpoints de export.

El backend recibe `pub_ids` como UUIDs en formato string. Pydantic ya los
valida y convierte; aquí además aplicamos un tope de tamaño para impedir
peticiones gigantes.
"""

from __future__ import annotations

from typing import List
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.config import settings


class PublicationIdsRequestSchema(BaseModel):
    pub_ids: List[UUID] = Field(
        min_length=1,
        max_length=settings.MAX_PUB_IDS_BATCH,
    )
