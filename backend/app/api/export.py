from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from uuid import UUID

from app.db.session import get_db
from app.db.models import Publication, Researcher
from app.security.api_key import get_api_key
from app.services.sword_generator import SWORDGenerator
from app.services.zip_generator import ZIPGenerator

router = APIRouter(prefix="/export")


def validate_uuid_list(pub_ids: list[str]) -> list[UUID]:
    valid_ids = []
    for pid in pub_ids:
        try:
            valid_ids.append(UUID(pid))
        except Exception:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid publication ID (not UUID): {pid}"
            )
    return valid_ids


@router.post("/sword/publications")
async def export_multiple_sword(
    pub_ids: list[str],
    db: Session = Depends(get_db),
    api_key: str = Depends(get_api_key)
):
    validate_uuid_list(pub_ids)

    pubs = db.query(Publication).filter(Publication.id.in_(pub_ids)).all()

    if not pubs:
        raise HTTPException(status_code=404, detail="No publications found")

    researcher = db.query(Researcher).filter_by(id=pubs[0].researcher_id).first()

    xml_bytes = SWORDGenerator.generate_feed_xml(researcher, pubs)
    return Response(content=xml_bytes, media_type="application/xml")


@router.get("/sword/researcher/{orcid_id}")
async def export_researcher_sword(
    orcid_id: str,
    db: Session = Depends(get_db),
    api_key: str = Depends(get_api_key)
):
    researcher = db.query(Researcher).filter_by(orcid_id=orcid_id).first()
    if not researcher:
        raise HTTPException(status_code=404, detail="Researcher not found")

    pubs = db.query(Publication).filter_by(researcher_id=researcher.id).all()

    if not pubs:
        raise HTTPException(status_code=404, detail="No publications found for this researcher")

    xml_bytes = SWORDGenerator.generate_feed_xml(researcher, pubs)
    return Response(content=xml_bytes, media_type="application/xml")


@router.post("/zip/publications")
async def export_multiple_zip(
    pub_ids: list[str],
    db: Session = Depends(get_db),
    api_key: str = Depends(get_api_key)
):
    validate_uuid_list(pub_ids)

    pubs = db.query(Publication).filter(Publication.id.in_(pub_ids)).all()

    if not pubs:
        raise HTTPException(status_code=404, detail="No publications found")

    researcher = db.query(Researcher).filter_by(id=pubs[0].researcher_id).first()

    zip_bytes = ZIPGenerator.generate_zip(researcher, pubs)
    return Response(content=zip_bytes, media_type="application/zip")


@router.get("/zip/researcher/{orcid_id}")
async def export_researcher_zip(
    orcid_id: str,
    db: Session = Depends(get_db),
    api_key: str = Depends(get_api_key)
):
    researcher = db.query(Researcher).filter_by(orcid_id=orcid_id).first()
    if not researcher:
        raise HTTPException(status_code=404, detail="Researcher not found")

    pubs = db.query(Publication).filter_by(researcher_id=researcher.id).all()

    if not pubs:
        raise HTTPException(status_code=404, detail="No publications found for this researcher")

    zip_bytes = ZIPGenerator.generate_zip(researcher, pubs)
    return Response(content=zip_bytes, media_type="application/zip")
