from datetime import datetime
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException, Path, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.models import Publication, PublicationDownload, Researcher
from app.db.session import get_db
from app.schema.publication import PublicationSchema
from app.schema.researcher import (
    ResearcherBatchSearchRequestSchema,
    ResearcherBatchSearchResponseSchema,
    ResearcherSearchErrorSchema,
    ResearcherStatsSchema,
    ResearcherWithPublicationsSchema,
)
from app.security.jwt import get_optional_current_researcher
from app.services.normalizer import PublicationNormalizer
from app.services.orcid_client import get_display_name, get_orcid_client
from app.utils.orcid_validator import ORCID_PATTERN, is_valid_orcid


router = APIRouter(prefix="/researchers", tags=["researchers"])


def publication_changed(existing: Publication, data: dict) -> bool:
    fields = [
        "title", "subtitle", "type", "journal",
        "pub_year", "pub_month", "pub_day",
        "doi", "url", "short_description",
        "citation_type", "citation_value",
        "language_code", "country",
        "external_ids", "contributors",
    ]
    return any(getattr(existing, f) != data[f] for f in fields)


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
    orcid_client = get_orcid_client()
    works = orcid_client.fetch_works(orcid_id)
    groups = works.get("group", [])

    publications: List[Publication] = []
    existing_by_put_code = {
        publication.put_code: publication
        for publication in db.query(Publication).filter(Publication.researcher_id == researcher.id).all()
    }

    for g in groups:
        summaries = g.get("work-summary") or []
        if not summaries:
            continue

        summary = summaries[0]
        put_code = summary.get("put-code")
        if put_code is None:
            continue

        try:
            detail = orcid_client.fetch_work_detail(orcid_id, put_code)
        except Exception:
            detail = None

        data = PublicationNormalizer.normalize(summary, detail)

        existing = existing_by_put_code.get(data["put_code"])

        if existing:
            for field in [
                "title", "subtitle", "type", "journal",
                "pub_year", "pub_month", "pub_day",
                "doi", "url", "short_description",
                "citation_type", "citation_value",
                "language_code", "country",
                "external_ids", "contributors",
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
            existing_by_put_code[data["put_code"]] = pub

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
            PublicationSchema.model_validate(p).model_copy(
                update={"downloaded_by_me": p.id in downloaded_ids}
            )
        )
    return out


def build_search_response(orcid_id: str, db: Session, current: Researcher | None) -> ResearcherWithPublicationsSchema:
    if not is_valid_orcid(orcid_id):
        raise HTTPException(status_code=400, detail="Invalid ORCID iD")

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
# ENDPOINT 1: SEARCH + SYNC
# ---------------------------------------------------------


@router.post(
    "/search",
    response_model=ResearcherBatchSearchResponseSchema,
    response_model_exclude_none=True,
)
@limiter.limit(settings.RATE_LIMIT_SEARCH_ANON)
def search_and_sync_researchers(
    request: Request,
    payload: ResearcherBatchSearchRequestSchema,
    db: Session = Depends(get_db),
    current: Researcher | None = Depends(get_optional_current_researcher),
):
    results: List[ResearcherWithPublicationsSchema] = []
    errors: List[ResearcherSearchErrorSchema] = []

    unique_orcid_ids = list(dict.fromkeys(payload.orcid_ids))

    for orcid_id in unique_orcid_ids:
        try:
            results.append(build_search_response(orcid_id, db, current))
        except HTTPException as exc:
            db.rollback()
            errors.append(
                ResearcherSearchErrorSchema(
                    orcid_id=orcid_id,
                    detail=str(exc.detail),
                )
            )
        except httpx.HTTPStatusError as exc:
            db.rollback()
            errors.append(
                ResearcherSearchErrorSchema(
                    orcid_id=orcid_id,
                    detail=f"ORCID returned {exc.response.status_code}",
                )
            )
        except Exception:
            db.rollback()
            errors.append(
                ResearcherSearchErrorSchema(
                    orcid_id=orcid_id,
                    detail="Unexpected error while processing ORCID iD",
                )
            )

    return ResearcherBatchSearchResponseSchema(
        results=results,
        errors=errors,
        total_requested=len(unique_orcid_ids),
        total_processed=len(results),
    )


# ---------------------------------------------------------
# ENDPOINT 2: SYNC COMPLETO (requiere autenticación)
# ---------------------------------------------------------

@router.post(
    "/{orcid_id}/sync",
    response_model=ResearcherWithPublicationsSchema,
    response_model_exclude_none=True,
)
@limiter.limit(settings.RATE_LIMIT_SYNC)
def sync_researcher(
    request: Request,
    orcid_id: str = Path(min_length=19, max_length=19, pattern=ORCID_PATTERN),
    db: Session = Depends(get_db),
    current: Researcher | None = Depends(get_optional_current_researcher),
):
    if not is_valid_orcid(orcid_id):
        raise HTTPException(status_code=400, detail="Invalid ORCID iD")

    researcher = db.query(Researcher).filter_by(orcid_id=orcid_id).first()
    if not researcher:
        raise HTTPException(status_code=404, detail="Researcher not found")

    orcid_client = get_orcid_client()
    works = orcid_client.fetch_works(orcid_id)
    groups = works.get("group", [])

    publications_output = []
    new_count = 0
    updated_count = 0
    unchanged_count = 0
    existing_by_put_code = {
        publication.put_code: publication
        for publication in db.query(Publication).filter(Publication.researcher_id == researcher.id).all()
    }

    for g in groups:
        summaries = g.get("work-summary") or []
        if not summaries:
            continue

        summary = summaries[0]
        put_code = summary.get("put-code")
        if put_code is None:
            continue

        try:
            detail = orcid_client.fetch_work_detail(orcid_id, put_code)
        except Exception:
            detail = None

        data = PublicationNormalizer.normalize(summary, detail)

        existing = existing_by_put_code.get(data["put_code"])

        if existing:
            if publication_changed(existing, data):
                for field in data:
                    setattr(existing, field, data[field])
                existing.last_modified = datetime.utcnow()
                existing.status = "updated"
                updated_count += 1
            else:
                existing.status = "unchanged"
                unchanged_count += 1

            pub = existing
        else:
            pub = Publication(
                researcher_id=researcher.id,
                **data,
                last_modified=datetime.utcnow(),
            )
            pub.status = "new"
            db.add(pub)
            new_count += 1
            existing_by_put_code[data["put_code"]] = pub

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
