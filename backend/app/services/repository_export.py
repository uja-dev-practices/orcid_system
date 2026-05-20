"""
Exportadores orientados a repositorios: Dublin Core, DSpace y EPrints.

Perfiles soportados (query `profile` en /export/sword/...):
- generic   → feed Atom ORCID (compatibilidad hacia atrás)
- dublin_core → XML con un registro DC por publicación
- dspace    → feed Atom con metadatos DSpace / Dublin Core ampliado
- eprints   → XML de importación EPrints (EP3)

El ZIP incluye todos los perfiles bajo `formats/` más SAF DSpace en `dspace-saf/`.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Iterable, List
from xml.etree.ElementTree import Element, SubElement, tostring

from app.db.models import Publication, Researcher

ATOM_NS = "http://www.w3.org/2005/Atom"
DC_NS = "http://purl.org/dc/elements/1.1/"
DCTERMS_NS = "http://purl.org/dc/terms/"
SWORD_NS = "http://purl.org/net/sword/"
EPRINTS_NS = "http://eprints.org/ep3/data"

EXPORT_PROFILES = ("generic", "dublin_core", "dspace", "eprints")

_DSPACE_TYPE_MAP = {
    "journal-article": "Article",
    "book-chapter": "Book chapter",
    "book": "Book",
    "conference-paper": "Conference paper",
    "conference-abstract": "Conference paper",
    "dissertation-thesis": "Thesis",
    "report": "Report",
    "preprint": "Preprint",
    "other": "Other",
}

_EPRINTS_TYPE_MAP = {
    "journal-article": "article",
    "book-chapter": "book_section",
    "book": "book",
    "conference-paper": "conference_item",
    "conference-abstract": "conference_item",
    "dissertation-thesis": "thesis",
    "report": "report",
    "preprint": "preprint",
    "other": "other",
}


def normalize_profile(profile: str | None) -> str:
    value = (profile or "generic").strip().lower()
    if value not in EXPORT_PROFILES:
        raise ValueError(
            f"Invalid export profile {profile!r}. "
            f"Use one of: {', '.join(EXPORT_PROFILES)}"
        )
    return value


def publication_date_iso(pub: Publication) -> str | None:
    if not pub.pub_year:
        return None
    date_str = str(pub.pub_year)
    if pub.pub_month:
        date_str += f"-{pub.pub_month:02d}"
        if pub.pub_day:
            date_str += f"-{pub.pub_day:02d}"
    return date_str


def contributor_names(pub: Publication) -> List[str]:
    names: List[str] = []
    for item in pub.contributors or []:
        name = (item or {}).get("name")
        if name:
            names.append(str(name))
    return names


def split_person_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split()
    if len(parts) <= 1:
        return full_name, ""
    return parts[-1], " ".join(parts[:-1])


def dspace_type(pub: Publication) -> str:
    if not pub.type:
        return "Other"
    return _DSPACE_TYPE_MAP.get(pub.type, pub.type.replace("-", " ").title())


def eprints_type(pub: Publication) -> str:
    if not pub.type:
        return "other"
    return _EPRINTS_TYPE_MAP.get(pub.type, "other")


def _safe_text(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if text.lower() == "none":
        return None
    return text or None


def _append_dc(parent: Element, tag: str, text: str | None) -> None:
    if text:
        SubElement(parent, tag).text = text


def generate_dublin_core_records_xml(
    researcher: Researcher,
    publications: Iterable[Publication],
) -> bytes:
    root = Element("dublinCoreRecords", {
        "researcherOrcid": researcher.orcid_id,
        "researcherName": researcher.name or "",
    })

    for pub in publications:
        record = SubElement(root, "record", {
            "id": str(pub.id),
            "putCode": str(pub.put_code),
        })
        _append_dc(record, f"{{{DC_NS}}}title", pub.title)
        _append_dc(record, f"{{{DC_NS}}}type", pub.type)
        _append_dc(record, f"{{{DC_NS}}}source", pub.journal)
        _append_dc(record, f"{{{DC_NS}}}language", pub.language_code)
        _append_dc(record, f"{{{DC_NS}}}coverage", pub.country)
        _append_dc(record, f"{{{DC_NS}}}description", pub.short_description or pub.subtitle)
        _append_dc(record, f"{{{DC_NS}}}bibliographicCitation", pub.citation_value)
        if pub.doi:
            _append_dc(record, f"{{{DC_NS}}}identifier", f"doi:{pub.doi}")
        if pub.url:
            _append_dc(record, f"{{{DC_NS}}}relation", pub.url)
        date_iso = publication_date_iso(pub)
        if date_iso:
            _append_dc(record, f"{{{DC_NS}}}date", date_iso)
        for name in contributor_names(pub):
            _append_dc(record, f"{{{DC_NS}}}creator", name)
        if researcher.orcid_id:
            _append_dc(record, f"{{{DC_NS}}}provenance", f"orcid:{researcher.orcid_id}")

    return tostring(root, encoding="utf-8", xml_declaration=True)


def generate_dspace_item_dublin_core(pub: Publication) -> bytes:
    root = Element("dublin_core")

    def dcvalue(element: str, qualifier: str, value: str | None) -> None:
        if value:
            SubElement(root, "dcvalue", element=element, qualifier=qualifier).text = value

    dcvalue("title", "none", pub.title)
    dcvalue("type", "none", dspace_type(pub))
    dcvalue("source", "none", pub.journal)
    dcvalue("language", "iso", pub.language_code)
    dcvalue("coverage", "spatial", pub.country)
    dcvalue("description", "abstract", pub.short_description or pub.subtitle)
    dcvalue("description", "none", pub.citation_value)
    date_iso = publication_date_iso(pub)
    if date_iso:
        dcvalue("date", "issued", date_iso)
    if pub.doi:
        dcvalue("identifier", "doi", pub.doi)
        dcvalue("identifier", "uri", f"https://doi.org/{pub.doi}")
    elif pub.url:
        dcvalue("identifier", "uri", pub.url)
    if pub.url:
        dcvalue("relation", "uri", pub.url)
    for name in contributor_names(pub):
        dcvalue("contributor", "author", name)

    return tostring(root, encoding="utf-8", xml_declaration=True)


def generate_dspace_import_csv(
    researcher: Researcher,
    publications: Iterable[Publication],
) -> str:
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_ALL, lineterminator="\n")
    writer.writerow([
        "row_id",
        "collection",
        "dc.title",
        "dc.contributor.author",
        "dc.date.issued",
        "dc.description",
        "dc.identifier.doi",
        "dc.identifier.uri",
        "dc.language.iso",
        "dc.publisher",
        "dc.relation.ispartof",
        "dc.source",
        "dc.type",
        "dc.provenance",
    ])

    for index, pub in enumerate(publications, start=1):
        authors = "; ".join(contributor_names(pub)) or (researcher.name or "")
        writer.writerow([
            index,
            "",
            pub.title or "",
            authors,
            publication_date_iso(pub) or "",
            pub.short_description or pub.citation_value or "",
            pub.doi or "",
            pub.url or (f"https://doi.org/{pub.doi}" if pub.doi else ""),
            pub.language_code or "",
            "",
            pub.journal or "",
            pub.journal or "",
            dspace_type(pub),
            f"orcid:{researcher.orcid_id}",
        ])

    return output.getvalue()


def generate_dspace_sword_feed_xml(
    researcher: Researcher,
    publications: Iterable[Publication],
) -> bytes:
    """
    Feed Atom orientado a ingest DSpace (metadatos DC/dcterms por entry).
    No sustituye un depósito SWORD 2.0 con bitstreams, pero alinea campos DC.
    """
    feed = Element("feed", {
        "xmlns": ATOM_NS,
        "xmlns:dc": DC_NS,
        "xmlns:dcterms": DCTERMS_NS,
        "xmlns:sword": SWORD_NS,
    })

    SubElement(feed, "title").text = f"DSpace export for {researcher.orcid_id}"
    SubElement(feed, "id").text = f"urn:uuid:{researcher.id}"
    SubElement(feed, "updated").text = datetime.utcnow().isoformat() + "Z"
    author = SubElement(feed, "author")
    SubElement(author, "name").text = researcher.name or researcher.orcid_id

    for pub in publications:
        entry = SubElement(feed, "entry")
        SubElement(entry, "title").text = pub.title or "Untitled"
        SubElement(entry, "id").text = f"urn:uuid:{pub.id}"
        SubElement(entry, "updated").text = datetime.utcnow().isoformat() + "Z"
        SubElement(entry, f"{{{SWORD_NS}}}deposit").text = "true"
        SubElement(entry, f"{{{SWORD_NS}}}noOp").text = "false"

        category = SubElement(entry, "category")
        category.set("term", dspace_type(pub))
        category.set("scheme", "http://dspace.org/itemtypes")

        if pub.title:
            SubElement(entry, f"{{{DC_NS}}}title").text = pub.title
        if pub.journal:
            SubElement(entry, f"{{{DC_NS}}}source").text = pub.journal
        if pub.doi:
            SubElement(entry, f"{{{DC_NS}}}identifier").text = f"doi:{pub.doi}"
        if pub.url:
            SubElement(entry, f"{{{DCTERMS_NS}}}relation").text = pub.url
        if pub.short_description:
            SubElement(entry, f"{{{DCTERMS_NS}}}abstract").text = pub.short_description
        if pub.citation_value:
            SubElement(entry, f"{{{DCTERMS_NS}}}bibliographicCitation").text = pub.citation_value
        if pub.language_code:
            SubElement(entry, f"{{{DC_NS}}}language").text = pub.language_code
        date_iso = publication_date_iso(pub)
        if date_iso:
            SubElement(entry, f"{{{DCTERMS_NS}}}issued").text = date_iso
        SubElement(entry, f"{{{DC_NS}}}type").text = dspace_type(pub)
        for name in contributor_names(pub):
            author_el = SubElement(entry, "author")
            SubElement(author_el, "name").text = name

    return tostring(feed, encoding="utf-8", xml_declaration=True)


def generate_eprints_import_xml(
    researcher: Researcher,
    publications: Iterable[Publication],
) -> bytes:
    root = Element("eprints", xmlns=EPRINTS_NS)
    today = datetime.utcnow().strftime("%Y-%m-%d")

    for index, pub in enumerate(publications, start=1):
        eprint = SubElement(root, "eprint")
        SubElement(eprint, "eprintid").text = str(index)
        SubElement(eprint, "rev_number").text = "1"
        SubElement(eprint, "documents")
        SubElement(eprint, "eprint_status").text = "archive"
        SubElement(eprint, "userid").text = "1"
        SubElement(eprint, "dir").text = f"disk00000/00/00/{index:02d}"
        SubElement(eprint, "datestamp").text = today
        SubElement(eprint, "lastmod").text = today
        SubElement(eprint, "status_changed").text = today
        SubElement(eprint, "type").text = eprints_type(pub)

        titles = SubElement(eprint, "titles")
        title_item = SubElement(titles, "item")
        SubElement(title_item, "lang").text = pub.language_code or "en"
        SubElement(title_item, "title").text = pub.title or "Untitled"

        creators = SubElement(eprint, "creators")
        names = contributor_names(pub) or ([researcher.name] if researcher.name else [])
        for name in names:
            family, given = split_person_name(name)
            item = SubElement(creators, "item")
            name_el = SubElement(item, "name")
            SubElement(name_el, "family").text = family
            if given:
                SubElement(name_el, "given").text = given

        if pub.pub_year:
            SubElement(eprint, "date").text = str(pub.pub_year)
        if pub.journal:
            SubElement(eprint, "publication").text = pub.journal
        if pub.doi:
            SubElement(eprint, "doi").text = pub.doi
        if pub.url:
            SubElement(eprint, "official_url").text = pub.url
        if pub.short_description:
            SubElement(eprint, "abstract").text = pub.short_description
        if pub.citation_value:
            SubElement(eprint, "note").text = pub.citation_value
        if researcher.orcid_id:
            SubElement(eprint, "note").text = f"Source ORCID: {researcher.orcid_id}"

    return tostring(root, encoding="utf-8", xml_declaration=True)


def generate_repository_xml(
    researcher: Researcher,
    publications: List[Publication],
    profile: str,
) -> bytes:
    profile = normalize_profile(profile)
    if profile == "dublin_core":
        return generate_dublin_core_records_xml(researcher, publications)
    if profile == "dspace":
        return generate_dspace_sword_feed_xml(researcher, publications)
    if profile == "eprints":
        return generate_eprints_import_xml(researcher, publications)
    from app.services.sword_generator import SWORDGenerator

    return SWORDGenerator.generate_feed_xml(researcher, publications)


def export_filename_for_profile(profile: str) -> str:
    profile = normalize_profile(profile)
    return {
        "generic": "generic-atom.xml",
        "dublin_core": "dublin_core.xml",
        "dspace": "dspace-atom.xml",
        "eprints": "eprints-import.xml",
    }[profile]
