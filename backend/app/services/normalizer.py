from typing import List


def _get(d: dict | None, *keys, default=None):
    cur = d or {}
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k)
        if cur is None:
            return default
    return cur


class PublicationNormalizer:
    @staticmethod
    def normalize(summary: dict, detail: dict | None = None) -> dict:
        """
        summary: work-summary de ORCID
        detail: work completo (puede ser None si la llamada falla)
        """

        # --- Core desde summary ---
        put_code = summary.get("put-code")

        title = _get(summary, "title", "title", "value")
        type_ = summary.get("type")

        journal = _get(summary, "journal-title", "value")

        year = _get(summary, "publication-date", "year", "value")
        month = _get(summary, "publication-date", "month", "value")
        day = _get(summary, "publication-date", "day", "value")

        url = _get(summary, "url", "value")
        short_description = summary.get("short-description")

        # DOI desde summary (external-ids)
        doi = None
        external_ids_list: List[dict] = _get(
            summary, "external-ids", "external-id", default=[]
        ) or []
        for ext in external_ids_list:
            if ext.get("external-id-type") == "doi":
                doi = ext.get("external-id-value")
                break

        # --- Si tenemos detail, enriquecemos ---
        subtitle = None
        citation_type = None
        citation_value = None
        language_code = None
        country = None
        external_ids_full: List[dict] | None = None
        contributors: List[dict] | None = None

        if detail:
            # Subtitle
            subtitle = _get(detail, "title", "subtitle", "value") or subtitle

            # Citation
            citation_type = _get(detail, "citation", "citation-type")
            citation_value = _get(detail, "citation", "citation-value")

            # Language
            language_code = detail.get("language-code")

            # Country
            country = _get(detail, "country", "value")

            # External IDs completos
            external_ids_full = _get(
                detail, "external-ids", "external-id", default=[]
            ) or []

            # Contributors
            raw_contributors = _get(
                detail, "contributors", "contributor", default=[]
            ) or []
            contributors = []
            for c in raw_contributors:
                contributors.append(
                    {
                        "name": _get(c, "credit-name", "value"),
                        "orcid": _get(c, "contributor-orcid", "path"),
                        "role": _get(
                            c, "contributor-attributes", "contributor-role"
                        ),
                    }
                )

        return {
            "put_code": put_code,
            "title": title,
            "subtitle": subtitle,
            "type": type_,
            "journal": journal,
            "pub_year": int(year) if year is not None else None,
            "pub_month": int(month) if month is not None else None,
            "pub_day": int(day) if day is not None else None,
            "doi": doi,
            "url": url,
            "short_description": short_description,
            "citation_type": citation_type,
            "citation_value": citation_value,
            "language_code": language_code,
            "country": country,
            "external_ids": external_ids_full,
            "contributors": contributors,
            "hash_fingerprint": None,
        }
