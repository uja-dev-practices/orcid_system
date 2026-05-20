"""
Enriquecimiento de publicaciones desde ORCID (/work/{put_code}).

- Sync rápido: solo resumen de /works; no pisa campos de detalle ya guardados.
- Publicaciones nuevas en sync: se pide detalle siempre (pocas por ciclo).
- Exportación: se completa detalle solo de las obras que se van a descargar.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Iterable, List

from sqlalchemy.orm import Session

from app.db.models import Publication, Researcher
from app.services.normalizer import PublicationNormalizer
from app.services.orcid_client import get_orcid_client

logger = logging.getLogger("app.services.publication_enrichment")

# Campos que solo suelen venir del GET /work/{put_code}
DETAIL_ONLY_FIELDS = (
    "subtitle",
    "citation_type",
    "citation_value",
    "language_code",
    "country",
    "external_ids",
    "contributors",
)

UPDATABLE_FIELDS = (
    "title",
    "subtitle",
    "type",
    "journal",
    "pub_year",
    "pub_month",
    "pub_day",
    "doi",
    "url",
    "short_description",
    "citation_type",
    "citation_value",
    "language_code",
    "country",
    "external_ids",
    "contributors",
)


def publication_lacks_detail(pub: Publication) -> bool:
    """True si nunca se guardó detalle ORCID (contribuidores/cita/ids extendidos)."""
    return (
        pub.contributors is None
        and pub.citation_value is None
        and pub.external_ids is None
        and pub.subtitle is None
    )


def apply_publication_data(
    pub: Publication,
    data: dict,
    *,
    preserve_detail_if_missing: bool,
) -> None:
    for field in UPDATABLE_FIELDS:
        value = data.get(field)
        if (
            preserve_detail_if_missing
            and field in DETAIL_ONLY_FIELDS
            and value is None
        ):
            continue
        setattr(pub, field, value)


def _summary_by_put_code(works_payload: dict) -> dict[int, dict]:
    out: dict[int, dict] = {}
    for group in works_payload.get("group", []) or []:
        summaries = group.get("work-summary") or []
        if not summaries:
            continue
        summary = summaries[0]
        put_code = summary.get("put-code")
        if put_code is not None:
            out[int(put_code)] = summary
    return out


def _fetch_detail_safe(orcid_id: str, put_code: int) -> dict | None:
    try:
        return get_orcid_client().fetch_work_detail(orcid_id, put_code)
    except Exception:
        logger.exception("ORCID work detail failed orcid=%s put_code=%s", orcid_id, put_code)
        return None


def enrich_publications_from_orcid(
    db: Session,
    researcher: Researcher,
    publications: Iterable[Publication],
    *,
    max_workers: int = 6,
) -> None:
    """
    Completa en BD (y en memoria) el detalle ORCID de obras que aún no lo tienen.
    Solo actúa sobre publicaciones pasadas en `publications` (p. ej. las que se exportan).
    """
    to_enrich = [p for p in publications if publication_lacks_detail(p)]
    if not to_enrich:
        return

    orcid_id = researcher.orcid_id
    client = get_orcid_client()
    try:
        works = client.fetch_works(orcid_id)
    except Exception:
        logger.exception("Could not fetch ORCID works for enrichment orcid=%s", orcid_id)
        return

    summaries = _summary_by_put_code(works)
    put_codes = [p.put_code for p in to_enrich if p.put_code in summaries]
    if not put_codes:
        return

    details: dict[int, dict | None] = {}
    workers = max(1, min(max_workers, len(put_codes)))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(_fetch_detail_safe, orcid_id, pc): pc for pc in put_codes
        }
        for fut in as_completed(futures):
            pc = futures[fut]
            details[pc] = fut.result()

    for pub in to_enrich:
        summary = summaries.get(pub.put_code)
        if not summary:
            continue
        detail = details.get(pub.put_code)
        if not detail:
            continue
        data = PublicationNormalizer.normalize(summary, detail)
        apply_publication_data(pub, data, preserve_detail_if_missing=False)

    db.commit()
    for pub in to_enrich:
        db.refresh(pub)
