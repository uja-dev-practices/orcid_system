from datetime import datetime
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import Publication, Researcher
from app.db.session import get_db
from app.schema.researcher import (
    ResearcherBatchSearchRequestSchema,
    ResearcherBatchSearchResponseSchema,
    ResearcherSearchErrorSchema,
    ResearcherStatsSchema,
    ResearcherWithPublicationsSchema,
)
from app.services.normalizer import PublicationNormalizer
from app.services.orcid_client import get_display_name, get_works_summary, get_work_detail
from app.schema.publication import PublicationSchema
from app.db.models import PublicationDownload
from app.security.jwt import get_optional_current_researcher

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


def build_researcher_stats(publications: list) -> ResearcherStatsSchema:
    publication_types: dict[str, int] = {}

    for publication in publications:
        pub_type = getattr(publication, "type", None) or "unknown"
        publication_types[pub_type] = publication_types.get(pub_type, 0) + 1

    return ResearcherStatsSchema(
        total_publications=len(publications),
        publication_types=publication_types,
    )


def _upsert_researcher_publications(
    researcher: Researcher,
    orcid_id: str,
    db: Session,
) -> List[Publication]:
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

    return publications


def _decorate_downloaded_by_me(
    *,
    db: Session,
    current: Researcher | None,
    publications: List[Publication],
) -> List[PublicationSchema] | List[Publication]:
    if not current:
        return publications

    downloaded_ids = {
        row[0]
        for row in (
            db.query(PublicationDownload.publication_id)
            .filter(PublicationDownload.researcher_id == current.id)
            .all()
        )
    }

    out: List[PublicationSchema] = []
    for p in publications:
        out.append(
            PublicationSchema.model_validate(p).model_copy(update={"downloaded_by_me": p.id in downloaded_ids})
        )
    return out


def build_search_response(orcid_id: str, db: Session, current: Researcher | None) -> ResearcherWithPublicationsSchema:
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

    # Si todavía no conocemos el nombre del investigador (por ejemplo, recién
    # creado al sincronizarse desde el buscador), lo resolvemos contra el
    # endpoint `/record` público de ORCID. No tocamos un nombre ya existente
    # para no pisar valores establecidos por el flujo de autenticación.
    if not researcher.name:
        display_name = get_display_name(orcid_id)
        if display_name:
            researcher.name = display_name
            db.flush()

    publications = _upsert_researcher_publications(researcher, orcid_id, db)
    publications_out = _decorate_downloaded_by_me(db=db, current=current, publications=publications)
    stats = build_researcher_stats(publications_out)

    return ResearcherWithPublicationsSchema(
        researcher=researcher,
        publications=publications_out,
        stats=stats,
        new_records=0,
        updated_records=0,
        unchanged_records=0,
        total_records=len(publications_out),
    )


# ---------------------------------------------------------
# ENDPOINT 1: SEARCH + SYNC (sin contadores)
# ---------------------------------------------------------
@router.post("/search", response_model=ResearcherBatchSearchResponseSchema, response_model_exclude_none=True)
def search_and_sync_researchers(
    payload: ResearcherBatchSearchRequestSchema,
    db: Session = Depends(get_db),
    current: Researcher | None = Depends(get_optional_current_researcher),
):
    results: List[ResearcherWithPublicationsSchema] = []
    errors: List[ResearcherSearchErrorSchema] = []

    # Evita llamadas duplicadas a ORCID conservando el orden de entrada.
    unique_orcid_ids = list(dict.fromkeys(payload.orcid_ids))

    for orcid_id in unique_orcid_ids:
        try:
            results.append(build_search_response(orcid_id, db, current))
        except httpx.HTTPStatusError as exc:
            db.rollback()
            errors.append(
                ResearcherSearchErrorSchema(
                    orcid_id=orcid_id,
                    detail=f"ORCID devolvió {exc.response.status_code} para {orcid_id}.",
                )
            )
        except Exception as exc:
            db.rollback()
            errors.append(
                ResearcherSearchErrorSchema(
                    orcid_id=orcid_id,
                    detail=str(exc),
                )
            )

    return ResearcherBatchSearchResponseSchema(
        results=results,
        errors=errors,
        total_requested=len(unique_orcid_ids),
        total_processed=len(results),
    )


# ---------------------------------------------------------
# ENDPOINT 2: SYNC COMPLETO (con contadores + status)
# ---------------------------------------------------------
@router.post("/{orcid_id}/sync", response_model=ResearcherWithPublicationsSchema, response_model_exclude_none=True)
def sync_researcher(
    orcid_id: str,
    db: Session = Depends(get_db),
    current: Researcher | None = Depends(get_optional_current_researcher),
):
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

    publications_out = _decorate_downloaded_by_me(db=db, current=current, publications=publications_output)

    return ResearcherWithPublicationsSchema(
        researcher=researcher,
        publications=publications_out,
        stats=build_researcher_stats(publications_out),
        new_records=new_count,
        updated_records=updated_count,
        unchanged_records=unchanged_count,
        total_records=new_count + updated_count + unchanged_count,
    )
