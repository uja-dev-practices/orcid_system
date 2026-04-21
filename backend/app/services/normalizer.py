class PublicationNormalizer:

    @staticmethod
    def safe_get_title(summary):
        t = summary.get("title")

        if t is None:
            return None

        # Caso 1: {"title": {"value": "..."}}
        if isinstance(t, dict) and "title" in t and isinstance(t["title"], dict):
            return t["title"].get("value")

        # Caso 2: {"title": {"title": "..."}} (muy común en /works)
        if isinstance(t, dict) and "title" in t and isinstance(t["title"], str):
            return t["title"]

        # Caso 3: {"title": "string"}
        if isinstance(t, str):
            return t

        # Caso 4: {"value": "..."}
        if isinstance(t, dict) and "value" in t:
            return t["value"]

        return None

    @staticmethod
    def normalize_work(summary: dict) -> dict:

        title = PublicationNormalizer.safe_get_title(summary)

        # Journal title
        journal_raw = summary.get("journal-title")
        if isinstance(journal_raw, dict):
            journal = journal_raw.get("value") or journal_raw.get("title")
        else:
            journal = journal_raw

        # DOI
        doi = None
        ext_ids = summary.get("external-ids", {}).get("external-id", [])
        for ext in ext_ids:
            if ext.get("external-id-type") == "doi":
                doi = ext.get("external-id-value")
                break

        # Publication year
        pub_year = (
            summary.get("publication-date", {})
                   .get("year", {})
                   .get("value")
        )

        # Type
        work_type = summary.get("type")

        # put-code
        put_code = summary.get("put-code")

        # Fingerprint
        fingerprint = f"{title}-{doi}-{pub_year}-{work_type}"
        if fingerprint:
            fingerprint = fingerprint.lower().replace(" ", "")

        return {
            "put_code": put_code,
            "title": title or "Untitled",
            "journal": journal,
            "doi": doi,
            "pub_year": pub_year,
            "type": work_type,
            "hash_fingerprint": fingerprint
        }
