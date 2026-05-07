import io
import zipfile
import json
from datetime import datetime
from xml.etree.ElementTree import Element, SubElement, tostring

from app.db.models import Publication, Researcher
from app.services.sword_generator import SWORDGenerator


class ZIPGenerator:

    # ---------------------------------------------------------
    # MANIFEST.TXT — más completo
    # ---------------------------------------------------------
    @staticmethod
    def generate_manifest(researcher, publications):
        lines = [
            "SWORD Deposit Package",
            "----------------------",
            f"Researcher ORCID: {researcher.orcid_id}",
            f"Researcher Name: {researcher.name}",
            f"Researcher UUID: {researcher.id}",
            f"Total Publications: {len(publications)}",
            f"Generated At: {datetime.utcnow().isoformat()}Z",
            "",
            "Publications:",
        ]

        for pub in publications:
            year = pub.pub_year or "Unknown"
            lines.append(
                f"- {pub.title} ({year}) | DOI={pub.doi} | TYPE={pub.type}"
            )

        return "\n".join(lines)

    # ---------------------------------------------------------
    # METADATA.JSON — ahora con TODOS los campos
    # ---------------------------------------------------------
    @staticmethod
    def generate_metadata_json(researcher, publications):
        data = {
            "researcher": {
                "orcid_id": researcher.orcid_id,
                "name": researcher.name,
                "id": str(researcher.id),
                "last_sync_at": researcher.last_sync_at.isoformat() if researcher.last_sync_at else None,
            },
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "publications": [],
        }

        for pub in publications:
            data["publications"].append({
                "id": str(pub.id),
                "put_code": pub.put_code,
                "title": pub.title,
                "subtitle": pub.subtitle,
                "doi": pub.doi,
                "journal": pub.journal,
                "type": pub.type,
                "url": pub.url,
                "short_description": pub.short_description,
                "citation_type": pub.citation_type,
                "citation_value": pub.citation_value,
                "language_code": pub.language_code,
                "country": pub.country,
                "pub_year": pub.pub_year,
                "pub_month": pub.pub_month,
                "pub_day": pub.pub_day,
                "external_ids": pub.external_ids,
                "contributors": pub.contributors,
                "hash_fingerprint": pub.hash_fingerprint,
                "last_modified": pub.last_modified.isoformat() if pub.last_modified else None,
                "status": getattr(pub, "status", None),
            })

        return json.dumps(data, indent=4)

    # ---------------------------------------------------------
    # METS.XML — ampliado con más metadatos
    # ---------------------------------------------------------
    @staticmethod
    def generate_mets_xml(researcher, publications):
        mets = Element("mets", xmlns="http://www.loc.gov/METS/")

        header = SubElement(mets, "metsHdr")
        agent = SubElement(header, "agent", ROLE="CREATOR", TYPE="OTHER")
        SubElement(agent, "name").text = "ORCID Exporter System"

        dmd_sec = SubElement(mets, "dmdSec", ID="dmd1")
        md_wrap = SubElement(dmd_sec, "mdWrap", MDTYPE="DC")
        xml_data = SubElement(md_wrap, "xmlData")

        for pub in publications:
            # Title
            SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}title").text = pub.title

            # Subtitle
            if pub.subtitle:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}description").text = pub.subtitle

            # DOI
            if pub.doi:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}identifier").text = f"doi:{pub.doi}"

            # Journal
            if pub.journal:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}source").text = pub.journal

            # URL
            if pub.url:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}relation").text = pub.url

            # Description
            if pub.short_description:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}description").text = pub.short_description

            # Citation
            if pub.citation_value:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}bibliographicCitation").text = pub.citation_value

            # Language
            if pub.language_code:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}language").text = pub.language_code

            # Country
            if pub.country:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}coverage").text = pub.country

            # Date
            if pub.pub_year:
                date_str = str(pub.pub_year)
                if pub.pub_month:
                    date_str += f"-{pub.pub_month:02d}"
                if pub.pub_day:
                    date_str += f"-{pub.pub_day:02d}"
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}date").text = date_str

            # Type
            if pub.type:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}type").text = pub.type

        return tostring(mets, encoding="utf-8", xml_declaration=True)

    # ---------------------------------------------------------
    # ZIP FINAL
    # ---------------------------------------------------------
    @staticmethod
    def generate_zip(researcher, publications):
        xml_bytes = SWORDGenerator.generate_feed_xml(researcher, publications)
        manifest = ZIPGenerator.generate_manifest(researcher, publications)
        metadata_json = ZIPGenerator.generate_metadata_json(researcher, publications)
        mets_xml = ZIPGenerator.generate_mets_xml(researcher, publications)

        mem_file = io.BytesIO()
        with zipfile.ZipFile(mem_file, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("sword.xml", xml_bytes)
            zf.writestr("manifest.txt", manifest)
            zf.writestr("metadata.json", metadata_json)
            zf.writestr("mets.xml", mets_xml)

        mem_file.seek(0)
        return mem_file.read()
