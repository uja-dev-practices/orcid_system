from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import Publication, Researcher
from app.db.session import get_db
from app.schema.researcher import ResearcherWithPublicationsSchema
from app.services.normalizer import PublicationNormalizer
from app.services.orcid_client import get_works_summary, get_work_detail

router = APIRouter(prefix="/researchers", tags=["researchers"])


# ---------------------------------------------------------
# Función auxiliar: detectar si una publicación ha cambiado
# ---------------------------------------------------------
def publication_changed(existing: Publication, data: dict) -> bool:
    fields = [
        "title", "subtitle", "type", "journal",
        "pub_year", "pub_month", "pub_day",
        "doi", "url", "short_description",
        "citation_type", "citation_value",
        "language_code", "country",
        "external_ids", "contributors"
    ]

    for f in fields:
        if getattr(existing, f) != data[f]:
            return True
    return False


# ---------------------------------------------------------
# ENDPOINT 1: SEARCH + SYNC (sin contadores)
# ---------------------------------------------------------
@router.get("/search/{orcid_id}", response_model=ResearcherWithPublicationsSchema)
def search_and_sync_researcher(orcid_id: str, db: Session = Depends(get_db)):
    # Buscar o crear Researcher
    researcher = db.query(Researcher).filter(Researcher.orcid_id == orcid_id).first()
    if not researcher:
        researcher = Researcher(
            orcid_id=orcid_id,
            name=None,
            authenticated=False,
            last_sync_at=None,
        )
        db.add(researcher)
        db.flush()

    # Obtener works summary desde ORCID
    works = get_works_summary(orcid_id)
    groups = works.get("group", [])

    publications: List[Publication] = []

    for g in groups:
        summaries = g.get("work-summary") or []
        if not summaries:
            continue

        summary = summaries[0]
        put_code = summary.get("put-code")
        if put_code is None:
            continue

        # Obtener detalle del work
        try:
            detail = get_work_detail(orcid_id, put_code)
        except Exception:
            detail = None

        # Normalizar datos
        data = PublicationNormalizer.normalize(summary, detail)

        # Ver si ya existe la publicación
        existing = (
            db.query(Publication)
            .filter(
                Publication.researcher_id == researcher.id,
                Publication.put_code == data["put_code"],
            )
            .first()
        )

        if existing:
            for field in [
                "title", "subtitle", "type", "journal",
                "pub_year", "pub_month", "pub_day",
                "doi", "url", "short_description",
                "citation_type", "citation_value",
                "language_code", "country",
                "external_ids", "contributors"
            ]:
                setattr(existing, field, data[field])
            existing.last_modified = datetime.utcnow()
            existing.status = None
            publications.append(existing)
        else:
            pub = Publication(
                researcher_id=researcher.id,
                **data,
                last_modified=datetime.utcnow(),
            )
            pub.status = None
            db.add(pub)
            publications.append(pub)

    researcher.last_sync_at = datetime.utcnow()
    db.commit()
    db.refresh(researcher)

    return ResearcherWithPublicationsSchema(
        researcher=researcher,
        publications=publications,
        new_records=0,
        updated_records=0,
        unchanged_records=0,
        total_records=len(publications),
    )


# ---------------------------------------------------------
# ENDPOINT 2: SYNC COMPLETO (con contadores + status)
# ---------------------------------------------------------
@router.post("/{orcid_id}/sync", response_model=ResearcherWithPublicationsSchema)
def sync_researcher(orcid_id: str, db: Session = Depends(get_db)):
    researcher = db.query(Researcher).filter_by(orcid_id=orcid_id).first()
    if not researcher:
        raise HTTPException(status_code=404, detail="Researcher not found")

    works = get_works_summary(orcid_id)
    groups = works.get("group", [])

    publications_output = []

    new_count = 0
    updated_count = 0
    unchanged_count = 0

    for g in groups:
        summaries = g.get("work-summary") or []
        if not summaries:
            continue

        summary = summaries[0]
        put_code = summary.get("put-code")
        if put_code is None:
            continue

        try:
            detail = get_work_detail(orcid_id, put_code)
        except Exception:
            detail = None

        data = PublicationNormalizer.normalize(summary, detail)

        existing = (
            db.query(Publication)
            .filter(
                Publication.researcher_id == researcher.id,
                Publication.put_code == data["put_code"],
            )
            .first()
        )

        if existing:
            if publication_changed(existing, data):
                # updated
                for field in data:
                    setattr(existing, field, data[field])
                existing.last_modified = datetime.utcnow()
                existing.status = "updated"
                updated_count += 1
            else:
                # unchanged
                existing.status = "unchanged"
                unchanged_count += 1

            pub = existing

        else:
            # new
            pub = Publication(
                researcher_id=researcher.id,
                **data,
                last_modified=datetime.utcnow(),
            )
            pub.status = "new"
            db.add(pub)
            new_count += 1

        db.flush()
        publications_output.append(pub)

    researcher.last_sync_at = datetime.utcnow()
    db.commit()
    db.refresh(researcher)

    return ResearcherWithPublicationsSchema(
        researcher=researcher,
        publications=publications_output,
        new_records=new_count,
        updated_records=updated_count,
        unchanged_records=unchanged_count,
        total_records=new_count + updated_count + unchanged_count,
    )
