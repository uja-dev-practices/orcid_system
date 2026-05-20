from typing import Iterable, List
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.models import Publication, PublicationDownload, Researcher
from app.db.session import get_db
from app.security.export_auth import require_export_access
from app.services.orcid_client import get_display_name
from app.services.publication_enrichment import enrich_publications_from_orcid
from app.services.repository_export import EXPORT_PROFILES, generate_repository_xml
from app.services.zip_generator import ZIPGenerator
from app.utils.orcid_validator import ORCID_PATTERN, is_valid_orcid


router = APIRouter(prefix="/export")


def _record_downloads(db: Session, current: Researcher, pubs: Iterable[Publication]) -> None:
    """
    Inserta marcadores de descarga (researcher_id, publication_id).

    - Resuelve descargas existentes con UNA sola query.
    - Solo añade las que faltan.
    """
    pub_ids = [p.id for p in pubs]
    if not pub_ids:
        return

    existing_ids = {
        row[0]
        for row in (
            db.query(PublicationDownload.publication_id)
            .filter(
                PublicationDownload.researcher_id == current.id,
                PublicationDownload.publication_id.in_(pub_ids),
            )
            .all()
        )
    }

    new_rows = [
        PublicationDownload(researcher_id=current.id, publication_id=pid)
        for pid in pub_ids
        if pid not in existing_ids
    ]
    if new_rows:
        db.add_all(new_rows)
        db.commit()


def _prepare_researcher_and_publications_for_export(
    db: Session,
    researcher: Researcher,
    pubs: List[Publication],
) -> None:
    """Nombre del investigador y detalle ORCID de obras antes de generar SWORD/ZIP."""
    if not researcher.name:
        display_name = get_display_name(researcher.orcid_id)
        if display_name:
            researcher.name = display_name
            db.commit()
            db.refresh(researcher)

    enrich_publications_from_orcid(db, researcher, pubs)


def _validate_pub_ids(pub_ids: List[UUID]) -> List[UUID]:
    if len(pub_ids) > settings.MAX_PUB_IDS_BATCH:
        raise HTTPException(status_code=413, detail="Too many publication IDs")
    return pub_ids


def _raise_clear_error_if_researcher_id_was_used(db: Session, pub_ids: List[UUID]) -> None:
    """
    Si el cliente envía por error el UUID de un investigador al endpoint
    de publicaciones, devolvemos un mensaje explícito para guiar el uso.
    """
    if len(pub_ids) != 1:
        return

    researcher = db.query(Researcher).filter(Researcher.id == pub_ids[0]).first()
    if researcher:
        raise HTTPException(
            status_code=400,
            detail=(
                "The provided UUID belongs to a researcher, not a publication. "
                "Use publication IDs for this endpoint, or call "
                f"/api/export/sword/researcher/{researcher.orcid_id} "
                f"(or /api/export/zip/researcher/{researcher.orcid_id})."
            ),
        )


def _export_xml_response(
    researcher: Researcher,
    pubs: List[Publication],
    profile: str,
) -> Response:
    try:
        xml_bytes = generate_repository_xml(researcher, pubs, profile)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return Response(content=xml_bytes, media_type="application/xml")


# ---------------------------------------------------------
# ENDPOINT 1: SWORD múltiples publicaciones
# ---------------------------------------------------------

@router.post("/sword/publications")
@limiter.limit(settings.RATE_LIMIT_EXPORT)
async def export_multiple_sword(
    request: Request,
    pub_ids: List[UUID] = Body(..., min_length=1, max_length=settings.MAX_PUB_IDS_BATCH),
    profile: str = Query(
        "generic",
        description=(
            "Perfil de repositorio: generic (Atom ORCID), dublin_core, dspace, eprints. "
            f"Valores: {', '.join(EXPORT_PROFILES)}"
        ),
    ),
    db: Session = Depends(get_db),
    current: Researcher | None = Depends(require_export_access),
):
    _validate_pub_ids(pub_ids)

    pubs = db.query(Publication).filter(Publication.id.in_(pub_ids)).all()
    if not pubs:
        _raise_clear_error_if_researcher_id_was_used(db, pub_ids)
        raise HTTPException(status_code=404, detail="No publications found")

    researcher = db.query(Researcher).filter_by(id=pubs[0].researcher_id).first()
    if not researcher:
        raise HTTPException(status_code=404, detail="Researcher not found")

    _prepare_researcher_and_publications_for_export(db, researcher, pubs)

    response = _export_xml_response(researcher, pubs, profile)
    if current:
        _record_downloads(db, current, pubs)

    return response


# ---------------------------------------------------------
# ENDPOINT 2: SWORD por investigador
# ---------------------------------------------------------

@router.get("/sword/researcher/{orcid_id}")
@limiter.limit(settings.RATE_LIMIT_EXPORT)
async def export_researcher_sword(
    request: Request,
    orcid_id: str = Path(min_length=19, max_length=19, pattern=ORCID_PATTERN),
    profile: str = Query(
        "generic",
        description=(
            "Perfil de repositorio: generic (Atom ORCID), dublin_core, dspace, eprints. "
            f"Valores: {', '.join(EXPORT_PROFILES)}"
        ),
    ),
    db: Session = Depends(get_db),
    current: Researcher | None = Depends(require_export_access),
):
    if not is_valid_orcid(orcid_id):
        raise HTTPException(status_code=400, detail="Invalid ORCID iD")

    researcher = db.query(Researcher).filter_by(orcid_id=orcid_id).first()
    if not researcher:
        raise HTTPException(status_code=404, detail="Researcher not found")

    pubs = db.query(Publication).filter_by(researcher_id=researcher.id).all()
    if not pubs:
        raise HTTPException(status_code=404, detail="No publications found for this researcher")

    _prepare_researcher_and_publications_for_export(db, researcher, pubs)

    response = _export_xml_response(researcher, pubs, profile)
    if current:
        _record_downloads(db, current, pubs)

    return response


# ---------------------------------------------------------
# ENDPOINT 3: ZIP múltiples publicaciones
# ---------------------------------------------------------

@router.post("/zip/publications")
@limiter.limit(settings.RATE_LIMIT_EXPORT)
async def export_multiple_zip(
    request: Request,
    pub_ids: List[UUID] = Body(..., min_length=1, max_length=settings.MAX_PUB_IDS_BATCH),
    db: Session = Depends(get_db),
    current: Researcher | None = Depends(require_export_access),
):
    _validate_pub_ids(pub_ids)

    pubs = db.query(Publication).filter(Publication.id.in_(pub_ids)).all()
    if not pubs:
        _raise_clear_error_if_researcher_id_was_used(db, pub_ids)
        raise HTTPException(status_code=404, detail="No publications found")

    researcher = db.query(Researcher).filter_by(id=pubs[0].researcher_id).first()
    if not researcher:
        raise HTTPException(status_code=404, detail="Researcher not found")

    _prepare_researcher_and_publications_for_export(db, researcher, pubs)

    zip_bytes = ZIPGenerator.generate_zip(researcher, pubs)
    if current:
        _record_downloads(db, current, pubs)

    return Response(content=zip_bytes, media_type="application/zip")


# ---------------------------------------------------------
# ENDPOINT 4: ZIP por investigador
# ---------------------------------------------------------

@router.get("/zip/researcher/{orcid_id}")
@limiter.limit(settings.RATE_LIMIT_EXPORT)
async def export_researcher_zip(
    request: Request,
    orcid_id: str = Path(min_length=19, max_length=19, pattern=ORCID_PATTERN),
    db: Session = Depends(get_db),
    current: Researcher | None = Depends(require_export_access),
):
    if not is_valid_orcid(orcid_id):
        raise HTTPException(status_code=400, detail="Invalid ORCID iD")

    researcher = db.query(Researcher).filter_by(orcid_id=orcid_id).first()
    if not researcher:
        raise HTTPException(status_code=404, detail="Researcher not found")

    pubs = db.query(Publication).filter_by(researcher_id=researcher.id).all()
    if not pubs:
        raise HTTPException(status_code=404, detail="No publications found for this researcher")

    _prepare_researcher_and_publications_for_export(db, researcher, pubs)

    zip_bytes = ZIPGenerator.generate_zip(researcher, pubs)
    if current:
        _record_downloads(db, current, pubs)

    return Response(content=zip_bytes, media_type="application/zip")