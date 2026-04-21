from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.schema.publication import PublicationSchema
from app.db.session import get_db
from app.repositories.researcher_repository import ResearcherRepository
from app.repositories.publication_repository import PublicationRepository
from app.services.sync_service import SyncService
from app.services.sword_exporter import SWORDExporter
from app.utils.orcid_validator import is_valid_orcid

router = APIRouter(prefix="/researchers", tags=["researchers"])


def validate_orcid_or_400(orcid_id: str):
    if not is_valid_orcid(orcid_id):
        raise HTTPException(
            status_code=400,
            detail=f"ORCID ID '{orcid_id}' no es válido según el formato y dígito de control."
        )


@router.post("/", response_model=dict)
def create_researcher(orcid_id: str, db: Session = Depends(get_db)):
    validate_orcid_or_400(orcid_id)

    existing = ResearcherRepository.get_by_orcid(db, orcid_id)
    if existing:
        return {
            "status": "ok",
            "message": "Researcher ya existe.",
            "orcid_id": existing.orcid_id,
            "id": existing.id
        }

    # Aquí podrías opcionalmente validar que el ORCID existe en ORCID API
    researcher = ResearcherRepository.create(db, orcid_id, name=None)

    return {
        "status": "ok",
        "message": "Researcher creado correctamente.",
        "orcid_id": researcher.orcid_id,
        "id": researcher.id
    }


@router.get("/{orcid_id}", response_model=dict)
def get_researcher(orcid_id: str, db: Session = Depends(get_db)):
    validate_orcid_or_400(orcid_id)

    researcher = ResearcherRepository.get_by_orcid(db, orcid_id)
    if not researcher:
        raise HTTPException(status_code=404, detail="Researcher not found")

    return {
        "orcid_id": researcher.orcid_id,
        "name": researcher.name,
        "authenticated": researcher.authenticated,
        "access_token": researcher.access_token,
        "id": researcher.id,
        "last_sync_at": researcher.last_sync_at,
    }


@router.post("/{orcid_id}/sync", response_model=dict)
def sync_researcher(orcid_id: str, db: Session = Depends(get_db)):
    validate_orcid_or_400(orcid_id)

    service = SyncService()
    result = service.sync_researcher(db, orcid_id)
    return result


@router.get("/{orcid_id}/publications", response_model=list[PublicationSchema], tags=["researchers"])
def get_publications(orcid_id: str, db: Session = Depends(get_db)):
    researcher = ResearcherRepository.get_by_orcid(db, orcid_id)
    if not researcher:
        raise HTTPException(status_code=404, detail="Researcher not found")
    return researcher.publications



@router.get("/{orcid_id}/export/sword.xml")
def export_sword_xml(orcid_id: str, db: Session = Depends(get_db)):
    validate_orcid_or_400(orcid_id)

    researcher = ResearcherRepository.get_by_orcid(db, orcid_id)
    if not researcher:
        raise HTTPException(status_code=404, detail="Researcher not found")

    pubs = PublicationRepository.list_by_researcher(db, researcher.id)
    xml_bytes = SWORDExporter.export_feed_xml(researcher, pubs)

    return Response(
        content=xml_bytes,
        media_type="application/xml",
        headers={
            "Content-Disposition": f'attachment; filename="sword_{orcid_id}.xml"'
        }
    )


@router.get("/{orcid_id}/export/sword.zip")
def export_sword_zip(orcid_id: str, db: Session = Depends(get_db)):
    validate_orcid_or_400(orcid_id)

    researcher = ResearcherRepository.get_by_orcid(db, orcid_id)
    if not researcher:
        raise HTTPException(status_code=404, detail="Researcher not found")

    pubs = PublicationRepository.list_by_researcher(db, researcher.id)
    zip_bytes = SWORDExporter.export_zip(researcher, pubs)

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="sword_{orcid_id}.zip"'
        }
    )
