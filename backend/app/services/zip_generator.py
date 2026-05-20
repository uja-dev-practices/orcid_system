import io
import json
import zipfile
from datetime import datetime

from app.db.models import Publication, Researcher
from app.services.repository_export import (
    export_filename_for_profile,
    generate_dspace_import_csv,
    generate_dspace_item_dublin_core,
    generate_dublin_core_records_xml,
    generate_dspace_sword_feed_xml,
    generate_eprints_import_xml,
)
from app.services.sword_generator import SWORDGenerator


class ZIPGenerator:

    @staticmethod
    def generate_manifest(researcher, publications):
        lines = [
            "ORCID Export Package",
            "--------------------",
            f"Researcher ORCID: {researcher.orcid_id}",
            f"Researcher Name: {researcher.name}",
            f"Researcher UUID: {researcher.id}",
            f"Total Publications: {len(publications)}",
            f"Generated At: {datetime.utcnow().isoformat()}Z",
            "",
            "Files:",
            "- sword.xml              → Atom genérico ORCID (compatibilidad)",
            "- formats/generic-atom.xml",
            "- formats/dublin_core.xml → Dublin Core (un registro por obra)",
            "- formats/dspace-atom.xml → Atom con metadatos DSpace",
            "- formats/dspace-import.csv → Importación batch CSV DSpace",
            "- formats/eprints-import.xml → Importación XML EPrints",
            "- dspace-saf/item_NNNNN/dublin_core.xml → Simple Archive Format (DSpace)",
            "- metadata.json          → Metadatos completos (JSON)",
            "- mets.xml               → METS simplificado (legacy)",
            "",
            "Repository hints:",
            "- DSpace: use dspace-saf/ (SAF) or formats/dspace-import.csv",
            "- EPrints: import formats/eprints-import.xml via admin tools",
            "- Dublin Core: use formats/dublin_core.xml",
            "",
            "SWORD endpoint profile query:",
            "  ?profile=generic|dublin_core|dspace|eprints",
            "",
            "Publications:",
        ]

        for pub in publications:
            year = pub.pub_year or "Unknown"
            lines.append(
                f"- {pub.title} ({year}) | DOI={pub.doi} | TYPE={pub.type}"
            )

        return "\n".join(lines)

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

    @staticmethod
    def generate_mets_xml(researcher, publications):
        from xml.etree.ElementTree import Element, SubElement, tostring

        mets = Element("mets", xmlns="http://www.loc.gov/METS/")

        header = SubElement(mets, "metsHdr")
        agent = SubElement(header, "agent", ROLE="CREATOR", TYPE="OTHER")
        SubElement(agent, "name").text = "ORCID Exporter System"

        dmd_sec = SubElement(mets, "dmdSec", ID="dmd1")
        md_wrap = SubElement(dmd_sec, "mdWrap", MDTYPE="DC")
        xml_data = SubElement(md_wrap, "xmlData")

        for pub in publications:
            SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}title").text = pub.title
            if pub.subtitle:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}description").text = pub.subtitle
            if pub.doi:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}identifier").text = f"doi:{pub.doi}"
            if pub.journal:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}source").text = pub.journal
            if pub.url:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}relation").text = pub.url
            if pub.short_description:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}description").text = pub.short_description
            if pub.citation_value:
                SubElement(
                    xml_data,
                    "{http://purl.org/dc/elements/1.1/}bibliographicCitation",
                ).text = pub.citation_value
            if pub.language_code:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}language").text = pub.language_code
            if pub.country:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}coverage").text = pub.country
            if pub.pub_year:
                date_str = str(pub.pub_year)
                if pub.pub_month:
                    date_str += f"-{pub.pub_month:02d}"
                if pub.pub_day:
                    date_str += f"-{pub.pub_day:02d}"
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}date").text = date_str
            if pub.type:
                SubElement(xml_data, "{http://purl.org/dc/elements/1.1/}type").text = pub.type

        return tostring(mets, encoding="utf-8", xml_declaration=True)

    @staticmethod
    def generate_zip(researcher, publications):
        generic_xml = SWORDGenerator.generate_feed_xml(researcher, publications)
        manifest = ZIPGenerator.generate_manifest(researcher, publications)
        metadata_json = ZIPGenerator.generate_metadata_json(researcher, publications)
        mets_xml = ZIPGenerator.generate_mets_xml(researcher, publications)

        format_files = {
            f"formats/{export_filename_for_profile('generic')}": generic_xml,
            f"formats/{export_filename_for_profile('dublin_core')}": generate_dublin_core_records_xml(
                researcher, publications
            ),
            f"formats/{export_filename_for_profile('dspace')}": generate_dspace_sword_feed_xml(
                researcher, publications
            ),
            f"formats/{export_filename_for_profile('eprints')}": generate_eprints_import_xml(
                researcher, publications
            ),
        }

        mem_file = io.BytesIO()
        with zipfile.ZipFile(mem_file, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("sword.xml", generic_xml)
            zf.writestr("manifest.txt", manifest)
            zf.writestr("metadata.json", metadata_json)
            zf.writestr("mets.xml", mets_xml)
            zf.writestr(
                "formats/dspace-import.csv",
                generate_dspace_import_csv(researcher, publications),
            )

            for path, content in format_files.items():
                zf.writestr(path, content)

            for index, pub in enumerate(publications, start=1):
                item_dir = f"dspace-saf/item_{index:05d}"
                zf.writestr(
                    f"{item_dir}/dublin_core.xml",
                    generate_dspace_item_dublin_core(pub),
                )

        mem_file.seek(0)
        return mem_file.read()
